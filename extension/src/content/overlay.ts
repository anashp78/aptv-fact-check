const IS_DEV = !chrome.runtime.getManifest().update_url;
const API_BASE = IS_DEV
  ? "http://localhost:3100"
  : "https://aptv-fact-check-api.bluefield-56cc65a9.southcentralus.azurecontainerapps.io";

interface AnalysisData {
  video: Record<string, unknown> | null;
  comments: Record<string, unknown> | null;
  channel: Record<string, unknown> | null;
  sources: Record<string, unknown> | null;
  intel: Record<string, unknown> | null;
  error?: string;
}

let currentVideoId: string | null = null;
let panelVisible = false;
let analysisCache: Record<string, AnalysisData> = {};
let currentData: AnalysisData | null = null;
let analyzing = false;

const FETCH_TIMEOUT_MS = 90000;

function esc(str: unknown): string {
  const s = String(str ?? "");
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getExtUrl(path: string): string {
  return chrome.runtime.getURL(path);
}

// ── SVG Gauge Builder ───────────────────────────────────────────────────────

function svgGauge(value: number, label: string, size = 100, inverse = false): string {
  const radius = 38;
  const circumference = Math.PI * radius; // half circle
  const pct = Math.min(Math.max(value, 0), 100);
  const offset = circumference - (pct / 100) * circumference;

  let color: string;
  if (inverse) {
    color = pct <= 25 ? "#22c55e" : pct <= 50 ? "#f0b429" : pct <= 75 ? "#f97316" : "#dc2626";
  } else {
    color = pct >= 75 ? "#22c55e" : pct >= 50 ? "#f0b429" : pct >= 25 ? "#f97316" : "#dc2626";
  }

  return `
    <div class="aptv-gauge" style="width:${size}px">
      <svg viewBox="0 0 100 60" width="${size}" height="${size * 0.6}">
        <path d="M 10 55 A 38 38 0 0 1 90 55" fill="none" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round"/>
        <path d="M 10 55 A 38 38 0 0 1 90 55" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"
          stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" style="transition:stroke-dashoffset 1s ease"/>
        <text x="50" y="48" text-anchor="middle" fill="${color}" font-size="18" font-weight="800" font-family="Inter,sans-serif">${Math.round(value)}</text>
      </svg>
      <span class="aptv-gauge-label">${label}</span>
    </div>
  `;
}

function svgGradeBadge(grade: string): string {
  const colors: Record<string, string> = { A: "#22c55e", B: "#3b82f6", C: "#f0b429", D: "#f97316", F: "#dc2626" };
  const c = colors[grade] ?? "#dc2626";
  return `
    <svg viewBox="0 0 60 60" width="52" height="52">
      <circle cx="30" cy="30" r="27" fill="none" stroke="${c}" stroke-width="3"/>
      <circle cx="30" cy="30" r="22" fill="${c}22"/>
      <text x="30" y="36" text-anchor="middle" fill="${c}" font-size="24" font-weight="900" font-family="Inter,sans-serif">${grade}</text>
    </svg>
  `;
}

// ── Panel Creation ──────────────────────────────────────────────────────────

function createPanel(): HTMLElement {
  const existing = document.getElementById("aptv-panel");
  if (existing) return existing;

  const panel = document.createElement("div");
  panel.id = "aptv-panel";
  panel.innerHTML = `
    <div id="aptv-panel-inner">
      <div id="aptv-header">
        <div id="aptv-brand">
          <img src="${getExtUrl("aptv_logo.png")}" alt="APTV" id="aptv-logo" />
          <div id="aptv-brand-text">
            <span id="aptv-brand-name">ADVANTAGE PLAYER TV</span>
            <span id="aptv-brand-sub">FACT CHECK</span>
          </div>
        </div>
        <div id="aptv-grade-badge"></div>
        <div id="aptv-export-wrap" style="position:relative">
          <button id="aptv-export-btn" title="Export report">&#x2913;</button>
          <div id="aptv-export-menu" style="display:none">
            <button class="aptv-export-opt" data-format="summary">Copy Summary</button>
            <button class="aptv-export-opt" data-format="text">Full Text Report</button>
            <button class="aptv-export-opt" data-format="thread">Twitter/X Thread</button>
            <button class="aptv-export-opt" data-format="markdown">Markdown</button>
            <button class="aptv-export-opt" data-format="json">JSON Data</button>
            <button class="aptv-export-opt" data-format="csv">CSV (Claims)</button>
          </div>
        </div>
        <button id="aptv-refresh" title="Re-detect video">&#x21bb;</button>
        <button id="aptv-close">&times;</button>
      </div>
      <div id="aptv-tabs">
        <button class="aptv-tab active" data-tab="overview">OVERVIEW</button>
        <button class="aptv-tab" data-tab="claims">CLAIMS</button>
        <button class="aptv-tab" data-tab="comments">COMMENTS</button>
        <button class="aptv-tab" data-tab="intel">INTEL</button>
        <button class="aptv-tab" data-tab="sources">SOURCES</button>
        <button class="aptv-tab" data-tab="stats">STATS</button>
      </div>
      <div id="aptv-content">
        <div id="aptv-empty-state">
          <img src="${getExtUrl("aptv_logo.png")}" alt="APTV" style="width:140px;height:140px;border-radius:16px;margin-bottom:12px;" />
          <p style="font-size:14px;font-weight:600;color:#fff;">Ready to fact-check</p>
          <p style="font-size:12px;color:#888;">Works on any channel, any niche</p>
          <button id="aptv-analyze-btn">ANALYZE THIS VIDEO</button>
          <p class="aptv-tagline">Every niche. Every channel. Graded.</p>
        </div>
      </div>
      <div id="aptv-footer">
        <span>APTV Fact Check v0.2</span>
        <span class="aptv-footer-dot">&#x2022;</span>
        <span>advantageplayertv.com</span>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  document.getElementById("aptv-close")?.addEventListener("click", togglePanel);
  document.getElementById("aptv-analyze-btn")?.addEventListener("click", runAnalysis);
  document.getElementById("aptv-refresh")?.addEventListener("click", forceRefresh);

  // Export menu
  const exportBtn = document.getElementById("aptv-export-btn");
  const exportMenu = document.getElementById("aptv-export-menu");
  exportBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (exportMenu) exportMenu.style.display = exportMenu.style.display === "none" ? "block" : "none";
  });
  document.addEventListener("click", () => { if (exportMenu) exportMenu.style.display = "none"; });
  panel.querySelectorAll(".aptv-export-opt").forEach((opt) => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      const format = (opt as HTMLElement).dataset["format"] ?? "";
      exportData(format);
      if (exportMenu) exportMenu.style.display = "none";
    });
  });

  panel.querySelectorAll(".aptv-tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      const target = e.currentTarget as HTMLElement;
      panel.querySelectorAll(".aptv-tab").forEach((t) => t.classList.remove("active"));
      target.classList.add("active");
      renderTab(target.dataset["tab"] ?? "overview");
    });
  });

  return panel;
}

function createToggleButton(): void {
  if (document.getElementById("aptv-toggle")) return;
  const btn = document.createElement("div");
  btn.id = "aptv-toggle";
  btn.innerHTML = `<img src="${getExtUrl("aptv_logo.png")}" alt="APTV" style="width:40px;height:40px;border-radius:8px;" />`;
  btn.addEventListener("click", togglePanel);
  document.body.appendChild(btn);
}

function injectBadge(grade: string): void {
  document.getElementById("aptv-inline-badge")?.remove();
  const titleContainer = document.querySelector("#above-the-fold #title");
  if (!titleContainer) return;
  const badge = document.createElement("span");
  badge.id = "aptv-inline-badge";
  badge.className = `aptv-grade-inline aptv-grade-${grade.toLowerCase()}`;
  badge.textContent = grade;
  badge.title = "APTV Fact Check Grade — Click to open";
  badge.addEventListener("click", () => { if (!panelVisible) togglePanel(); });
  titleContainer.appendChild(badge);
}

// ── Toggle ──────────────────────────────────────────────────────────────────

function togglePanel(): void {
  const panel = document.getElementById("aptv-panel");
  if (!panel) return;
  panelVisible = !panelVisible;
  panel.classList.toggle("aptv-visible", panelVisible);
  const ytColumns = document.getElementById("columns");
  if (ytColumns) ytColumns.style.marginRight = panelVisible ? "420px" : "";
}

function forceRefresh(): void {
  // Force re-detect current video, clear cache for it, reset panel
  const videoId = extractVideoId();
  if (videoId) {
    delete analysisCache[videoId];
  }
  currentVideoId = null;
  currentData = null;

  // Reset grade badge
  const badge = document.getElementById("aptv-grade-badge");
  if (badge) badge.innerHTML = "";
  document.getElementById("aptv-inline-badge")?.remove();

  // Reset to empty state
  onVideoChange();

  // Flash the refresh button
  const btn = document.getElementById("aptv-refresh");
  if (btn) { btn.style.color = "#f0b429"; setTimeout(() => { btn.style.color = ""; }, 500); }
}

// ── Analysis ────────────────────────────────────────────────────────────────

async function runAnalysis(): Promise<void> {
  if (!currentVideoId || analyzing) return;
  const content = document.getElementById("aptv-content");
  if (!content) return;

  analyzing = true;

  content.innerHTML = `
    <div class="aptv-loading">
      <div class="aptv-spinner"></div>
      <p id="aptv-loading-status">Extracting transcript...</p>
      <div class="aptv-progress-steps">
        <span class="aptv-step active" id="aptv-step-1">Transcript</span>
        <span class="aptv-step" id="aptv-step-2">Claims</span>
        <span class="aptv-step" id="aptv-step-3">Fact Check</span>
        <span class="aptv-step" id="aptv-step-4">Comments</span>
        <span class="aptv-step" id="aptv-step-5">Intel</span>
      </div>
    </div>
  `;

  // Simulate progress steps based on typical timing
  const steps = [
    { id: 2, label: "Extracting claims...", delay: 3000 },
    { id: 3, label: "Fact checking claims...", delay: 6000 },
    { id: 4, label: "Analyzing comments...", delay: 9000 },
    { id: 5, label: "Researching channel...", delay: 12000 },
  ];
  const stepTimers: ReturnType<typeof setTimeout>[] = [];
  for (const s of steps) {
    stepTimers.push(setTimeout(() => {
      const status = document.getElementById("aptv-loading-status");
      if (status) status.textContent = s.label;
      const stepEl = document.getElementById(`aptv-step-${s.id}`);
      if (stepEl) stepEl.classList.add("active");
    }, s.delay));
  }

  try {
    const title = document.querySelector("yt-formatted-string.ytd-watch-metadata, h1.ytd-watch-metadata yt-formatted-string, h1.title")?.textContent?.trim() ?? document.title.replace(/ - YouTube$/, "");

    // Try multiple methods to get channel name — YouTube's DOM is inconsistent
    let channelName = "";
    // Method 1: DOM selectors (works on some layouts)
    const domSelectors = ["#channel-name a", "ytd-video-owner-renderer a", "#owner #channel-name yt-formatted-string a", "ytd-channel-name a", "#upload-info a", "a.yt-simple-endpoint.yt-formatted-string"];
    for (const sel of domSelectors) {
      const el = document.querySelector(sel);
      const text = el?.textContent?.trim();
      if (text && text.length > 1 && text.length < 100) { channelName = text; break; }
    }
    // Method 2: Extract from ytInitialPlayerResponse in page scripts
    if (!channelName) {
      const scripts = document.querySelectorAll("script");
      for (const s of scripts) {
        const text = s.textContent ?? "";
        const match = text.match(/"ownerChannelName"\s*:\s*"([^"]+)"/);
        if (match?.[1]) { channelName = match[1]; break; }
      }
    }
    // Method 3: Meta tags
    if (!channelName) {
      const metaAuthor = document.querySelector('meta[name="author"], link[itemprop="name"]');
      channelName = metaAuthor?.getAttribute("content") ?? metaAuthor?.getAttribute("href") ?? "";
    }
    console.log("[APTV] Detected:", { videoId: currentVideoId, title: title.substring(0, 50), channelName });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(`${API_BASE}/api/v1/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: currentVideoId, title, channelName }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`API ${response.status}: ${errBody.substring(0, 200)}`);
    }
    const data = (await response.json()) as AnalysisData;
    analysisCache[currentVideoId] = data;
    analyzing = false;
    stepTimers.forEach(clearTimeout);
    renderAnalysis(data);
  } catch (err) {
    analyzing = false;
    stepTimers.forEach(clearTimeout);
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[APTV] Analysis error:", msg);
    content.innerHTML = `
      <div class="aptv-error">
        <p>${esc(msg)}</p>
        <button id="aptv-retry-btn2" class="aptv-btn-retry">Retry</button>
      </div>
    `;
    document.getElementById("aptv-retry-btn2")?.addEventListener("click", runAnalysis);
  }
}

// ── Rendering ───────────────────────────────────────────────────────────────

function renderAnalysis(data: AnalysisData): void {
  currentData = data;
  if (data.error) {
    const content = document.getElementById("aptv-content");
    if (content) content.innerHTML = `<div class="aptv-error"><p>${data.error}</p></div>`;
    return;
  }
  const video = data.video as Record<string, unknown> | null;
  if (video?.grade) {
    const badge = document.getElementById("aptv-grade-badge");
    if (badge) badge.innerHTML = svgGradeBadge(video.grade as string);
    injectBadge(video.grade as string);
  }
  renderTab("overview");
}

function renderTab(tab: string): void {
  const content = document.getElementById("aptv-content");
  if (!content || !currentData) return;
  switch (tab) {
    case "overview": renderOverview(content); break;
    case "claims": renderClaims(content); break;
    case "comments": renderComments(content); break;
    case "intel": renderIntel(content); break;
    case "sources": renderSources(content); break;
    case "stats": renderStats(content); break;
  }
}

function scrapeCreatorInfo(): { name: string; subs: string; avatar: string } {
  let name = "";
  const domSelectors = ["#channel-name a", "ytd-video-owner-renderer a", "ytd-channel-name a", "#upload-info a", "a.yt-simple-endpoint.yt-formatted-string"];
  for (const sel of domSelectors) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text && text.length > 1 && text.length < 100) { name = text; break; }
  }
  if (!name) {
    const scripts = document.querySelectorAll("script");
    for (const s of scripts) {
      const match = (s.textContent ?? "").match(/"ownerChannelName"\s*:\s*"([^"]+)"/);
      if (match?.[1]) { name = match[1]; break; }
    }
  }
  const subs = document.querySelector("#owner-sub-count, yt-formatted-string#owner-sub-count")?.textContent?.trim() ?? "";
  const avatar = document.querySelector("ytd-video-owner-renderer img, #owner img, img.yt-core-image--loaded")?.getAttribute("src") ?? "";
  return { name, subs, avatar };
}

function scrapeEngagement(): { views: string; likes: string; ratio: string } {
  const viewsEl = document.querySelector("ytd-watch-info-text #info-strings yt-formatted-string");
  const views = viewsEl?.textContent?.trim() ?? "";
  const viewNum = parseInt(views.replace(/[^0-9]/g, ""), 10) || 0;

  const likeBtn = document.querySelector("#top-level-buttons-computed segmented-like-dislike-button-view-model button");
  const likeLabel = likeBtn?.getAttribute("aria-label") ?? "";
  const likeNum = parseInt(likeLabel.replace(/[^0-9]/g, ""), 10) || 0;

  let ratio = "—";
  if (viewNum > 0 && likeNum > 0) {
    const pct = (likeNum / viewNum) * 100;
    const grade = pct >= 5 ? "Excellent" : pct >= 3 ? "Good" : pct >= 1.5 ? "Average" : "Low";
    ratio = `${pct.toFixed(1)}% (${grade})`;
  }

  return { views, likes: likeNum > 0 ? likeNum.toLocaleString() : "—", ratio };
}

function renderOverview(el: HTMLElement): void {
  const video = currentData?.video as Record<string, unknown> | null;
  if (!video) { el.innerHTML = `<div class="aptv-empty">No analysis data</div>`; return; }

  const summary = (video["summary"] as string[]) ?? [];
  const claims = (video["claims"] as Record<string, unknown>[]) ?? [];
  const falseCount = claims.filter((c) => c["verdict"] === "false").length;
  const verifiedCount = claims.filter((c) => c["verdict"] === "verified").length;
  const unverifiedCount = claims.length - falseCount - verifiedCount;
  const falseClaims = claims.filter((c) => c["verdict"] === "false");
  const hasScores = video["accuracy"] != null;

  const creator = scrapeCreatorInfo();
  const engagement = scrapeEngagement();

  el.innerHTML = `
    ${creator.name ? `
    <div class="aptv-creator-card">
      ${creator.avatar ? `<img src="${creator.avatar}" class="aptv-creator-avatar" />` : ""}
      <div class="aptv-creator-info">
        <span class="aptv-creator-name">${creator.name}</span>
        <span class="aptv-creator-subs">${creator.subs}</span>
      </div>
      <div class="aptv-engagement">
        <div class="aptv-eng-item"><span class="aptv-eng-val">${engagement.views}</span></div>
        <div class="aptv-eng-item"><span class="aptv-eng-label">Likes</span><span class="aptv-eng-val">${engagement.likes}</span></div>
        <div class="aptv-eng-item"><span class="aptv-eng-label">Engagement</span><span class="aptv-eng-val">${engagement.ratio}</span></div>
      </div>
    </div>` : ""}

    ${video["niche"] ? `
    <div class="aptv-niche-bar">
      <span class="aptv-niche-label">${(video["niche"] as string).toUpperCase()}</span>
      ${video["nicheGrade"] ? `<span class="aptv-niche-grade">Niche Grade: <strong class="aptv-grade-${(video["nicheGrade"] as string).toLowerCase()}">${video["nicheGrade"]}</strong></span>` : ""}
    </div>` : ""}

    ${hasScores ? `
    <div class="aptv-section">
      <div class="aptv-gauges-row">
        ${svgGauge(video["accuracy"] as number ?? 0, "Accuracy", 90)}
        ${svgGauge(video["bsMeter"] as number ?? 0, "BS Meter", 90, true)}
        ${svgGauge(video["clickbait"] as number ?? 0, "Clickbait", 90, true)}
      </div>
      <div class="aptv-gauges-row">
        ${svgGauge(video["authenticity"] as number ?? 0, "Authenticity", 90)}
        ${svgGauge(video["originality"] as number ?? 0, "Originality", 90)}
        ${svgGauge(video["valueDelivered"] as number ?? 0, "Value", 90)}
      </div>
    </div>

    <div class="aptv-section">
      <h3 class="aptv-section-title">VERDICT</h3>
      <div class="aptv-verdict-bar">
        <div class="aptv-verdict-segment aptv-bg-green" style="flex:${verifiedCount || 0.1}">
          <span>${verifiedCount}</span>
          <small>Verified</small>
        </div>
        <div class="aptv-verdict-segment aptv-bg-red" style="flex:${falseCount || 0.1}">
          <span>${falseCount}</span>
          <small>False</small>
        </div>
        <div class="aptv-verdict-segment aptv-bg-gold" style="flex:${unverifiedCount || 0.1}">
          <span>${unverifiedCount}</span>
          <small>Unverified</small>
        </div>
      </div>
    </div>` : `
    <div class="aptv-section" style="text-align:center;padding:16px">
      <p style="color:#888;font-size:12px">No transcript available — video scoring requires captions.</p>
      <p style="color:#555;font-size:11px">Check the <strong style="color:#f0b429">INTEL</strong> and <strong style="color:#f0b429">COMMENTS</strong> tabs for channel analysis.</p>
    </div>`}

    ${falseClaims.length > 0 ? `
    <div class="aptv-section">
      <h3 class="aptv-section-title" style="color:#dc2626">RED FLAGS</h3>
      ${falseClaims.map((c) => `
        <div class="aptv-red-flag">
          <div class="aptv-red-flag-icon">&#9888;</div>
          <div class="aptv-red-flag-body">
            <p class="aptv-red-flag-claim">"${esc(c["text"])}"</p>
            <p class="aptv-red-flag-why">${esc(c["evidence"])}</p>
          </div>
        </div>
      `).join("")}
    </div>` : ""}

    ${hasScores && video["contentDensity"] != null ? `
    <div class="aptv-section">
      <h3 class="aptv-section-title">CONTENT DENSITY</h3>
      <div class="aptv-density-bar">
        <div class="aptv-density-fill" style="width:${video["contentDensity"]}%"></div>
      </div>
      <span class="aptv-density-label">${Math.round(video["contentDensity"] as number)}% substance — ${100 - Math.round(video["contentDensity"] as number)}% filler</span>
    </div>` : ""}

    ${summary.length > 0 ? `
    <div class="aptv-section">
      <h3 class="aptv-section-title">AI SUMMARY</h3>
      <ul class="aptv-summary-list">${summary.map((s) => `<li>${s}</li>`).join("")}</ul>
    </div>` : ""}

    <div class="aptv-section" style="text-align:center">
      <button id="aptv-share-btn" class="aptv-share-btn">COPY REPORT</button>
    </div>
  `;

  // Wire share button
  document.getElementById("aptv-share-btn")?.addEventListener("click", () => {
    const grade = video["grade"] as string;
    const accuracy = Math.round(video["accuracy"] as number);
    const bs = Math.round(video["bsMeter"] as number);
    const title = video["title"] as string ?? "";
    const report = [
      `APTV Fact Check Report`,
      `Video: ${title}`,
      `Grade: ${grade} | Accuracy: ${accuracy}% | BS Meter: ${bs}%`,
      `Claims: ${verifiedCount} Verified, ${falseCount} False, ${unverifiedCount} Unverified`,
      falseClaims.length > 0 ? `\nRed Flags:\n${falseClaims.map((c) => `- "${c["text"]}"`).join("\n")}` : "",
      `\nAnalyzed by APTV Fact Check — advantageplayertv.com`,
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(report).then(() => {
      const btn = document.getElementById("aptv-share-btn");
      if (btn) { btn.textContent = "COPIED!"; setTimeout(() => { btn.textContent = "COPY REPORT"; }, 2000); }
    });
  });
}

function renderClaims(el: HTMLElement): void {
  const video = currentData?.video as Record<string, unknown> | null;
  const claims = (video?.["claims"] as Record<string, unknown>[]) ?? [];
  if (claims.length === 0) { el.innerHTML = `<div class="aptv-empty">No claims extracted</div>`; return; }

  el.innerHTML = `
    <div class="aptv-section">
      <h3 class="aptv-section-title">CLAIMS (${claims.length})</h3>
      ${claims.map((c) => {
        const v = c["verdict"] as string;
        return `
          <div class="aptv-claim aptv-claim-${v}">
            <div class="aptv-claim-top">
              <span class="aptv-claim-text">${esc(c["text"])}</span>
              <span class="aptv-badge aptv-badge-${v}">${v.toUpperCase()}</span>
            </div>
            ${c["timestamp"] ? `<span class="aptv-claim-ts aptv-seekable" data-time="${esc(c["timestamp"])}">${c["timestamp"]} ▶</span>` : ""}
            ${c["evidence"] ? `<p class="aptv-claim-ev">${esc(c["evidence"])}</p>` : ""}
          </div>`;
      }).join("")}
    </div>
    ${claims.some((c) => c["verdict"] === "false") ? `
    <div class="aptv-section" style="text-align:center;margin-top:8px">
      <button id="aptv-gen-response" class="aptv-share-btn" style="background:#dc2626;border-color:#dc2626;color:#fff">GENERATE RESPONSE SCRIPT</button>
    </div>` : ""}
  `;

  // Wire response script generator
  document.getElementById("aptv-gen-response")?.addEventListener("click", async () => {
    const btn = document.getElementById("aptv-gen-response");
    if (!btn) return;
    btn.textContent = "Generating...";
    (btn as HTMLButtonElement).disabled = true;

    const video = currentData?.video as Record<string, unknown> | null;
    const falseClaims = claims.filter((c) => c["verdict"] === "false").map((c) => ({
      text: c["text"] as string, evidence: (c["evidence"] as string) ?? "",
    }));

    try {
      const resp = await fetch(`${API_BASE}/api/v1/response-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoTitle: video?.["title"] ?? "",
          channelName: scrapeCreatorInfo().name,
          grade: video?.["grade"] ?? "",
          summary: (video?.["summary"] as string[]) ?? [],
          falseClaims,
        }),
      });
      const data = (await resp.json()) as { script?: string; error?: string };
      if (data.script) {
        const scriptDiv = document.createElement("div");
        scriptDiv.className = "aptv-section";
        scriptDiv.innerHTML = `<h3 class="aptv-section-title" style="color:#dc2626">RESPONSE SCRIPT</h3><pre class="aptv-script">${esc(data.script)}</pre>
        <button class="aptv-share-btn aptv-copy-script" style="margin-top:8px">COPY SCRIPT</button>`;
        el.appendChild(scriptDiv);
        scriptDiv.querySelector(".aptv-copy-script")?.addEventListener("click", (e) => {
          const pre = scriptDiv.querySelector(".aptv-script");
          if (pre) {
            navigator.clipboard.writeText(pre.textContent ?? "").then(() => {
              (e.target as HTMLElement).textContent = "COPIED!";
              setTimeout(() => { (e.target as HTMLElement).textContent = "COPY SCRIPT"; }, 2000);
            });
          }
        });
        btn.textContent = "SCRIPT GENERATED ✓";
      } else {
        btn.textContent = data.error ?? "Failed";
      }
    } catch {
      btn.textContent = "Failed — try again";
      (btn as HTMLButtonElement).disabled = false;
    }
  });

  // Wire timestamp click-to-seek
  el.querySelectorAll(".aptv-seekable").forEach((span) => {
    span.addEventListener("click", () => {
      const timeStr = (span as HTMLElement).dataset["time"] ?? "";
      const parts = timeStr.split(":").map(Number);
      let seconds = 0;
      if (parts.length === 2) seconds = (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
      else if (parts.length === 3) seconds = (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
      const video = document.querySelector("video");
      if (video) { video.currentTime = seconds; video.play(); }
    });
  });
}

function renderComments(el: HTMLElement): void {
  const comments = currentData?.comments as Record<string, unknown> | null;
  if (!comments) { el.innerHTML = `<div class="aptv-empty">No comment analysis available.<br><span class="aptv-sub">Comments require YouTube Data API key.</span></div>`; return; }

  const sentiment = comments["sentiment"] as Record<string, number> | null;
  const sentimentScore = (comments["sentimentScore"] as number) ?? 50;
  const total = (comments["totalComments"] as number) ?? 0;
  const analyzed = (comments["analyzedComments"] as number) ?? 0;
  const praises = (comments["topPraises"] as string[]) ?? [];
  const complaints = (comments["topComplaints"] as string[]) ?? [];
  const agreement = (comments["agreementWithVideo"] as number) ?? 50;
  const echoChamber = Number(comments["echoChamberScore"] ?? comments["echoChamberId"] ?? 0);
  const clusters = (comments["suspiciousClusters"] as Record<string, unknown>[]) ?? [];
  const commenters = (comments["commenters"] as Record<string, unknown>[]) ?? [];
  const summary = (comments["summary"] as string) ?? "";

  const pos = sentiment?.positive ?? 0;
  const neg = sentiment?.negative ?? 0;
  const neu = sentiment?.neutral ?? 0;
  const mix = sentiment?.mixed ?? 0;

  el.innerHTML = `
    <div class="aptv-section">
      <div class="aptv-gauges-row" style="justify-content:center">
        ${svgGauge(sentimentScore, "Sentiment", 120)}
      </div>
      ${summary ? `<p style="text-align:center;font-size:12px;color:#ccc;margin:8px 0">${esc(summary)}</p>` : ""}
      <div class="aptv-stat-pills" style="justify-content:center">
        <span class="aptv-pill">${total} total</span>
        <span class="aptv-pill">${analyzed} analyzed</span>
      </div>
    </div>

    <div class="aptv-section">
      <h3 class="aptv-section-title">SENTIMENT BREAKDOWN</h3>
      <div class="aptv-sentiment-bar">
        ${pos > 0 ? `<div class="aptv-sent-seg aptv-sent-pos" style="flex:${pos}" title="Positive ${pos}%"><span>${pos}%</span></div>` : ""}
        ${neu > 0 ? `<div class="aptv-sent-seg aptv-sent-neu" style="flex:${neu}" title="Neutral ${neu}%"><span>${neu}%</span></div>` : ""}
        ${mix > 0 ? `<div class="aptv-sent-seg aptv-sent-mix" style="flex:${mix}" title="Mixed ${mix}%"><span>${mix}%</span></div>` : ""}
        ${neg > 0 ? `<div class="aptv-sent-seg aptv-sent-neg" style="flex:${neg}" title="Negative ${neg}%"><span>${neg}%</span></div>` : ""}
      </div>
      <div class="aptv-sent-legend">
        <span class="aptv-sent-dot" style="background:#22c55e"></span> Positive
        <span class="aptv-sent-dot" style="background:#64748b"></span> Neutral
        <span class="aptv-sent-dot" style="background:#f0b429"></span> Mixed
        <span class="aptv-sent-dot" style="background:#dc2626"></span> Negative
      </div>
    </div>

    <div class="aptv-section">
      <div class="aptv-gauges-row">
        ${svgGauge(agreement, "Agreement", 90)}
        ${svgGauge(echoChamber, "Echo Chamber", 90, true)}
      </div>
    </div>

    ${praises.length > 0 || complaints.length > 0 ? `
    <div class="aptv-section">
      <div style="display:flex;gap:12px">
        ${praises.length > 0 ? `
        <div style="flex:1">
          <h3 class="aptv-section-title" style="color:#22c55e">PRAISES</h3>
          ${praises.map((p) => `<div class="aptv-feedback-item aptv-fb-pos">${esc(p)}</div>`).join("")}
        </div>` : ""}
        ${complaints.length > 0 ? `
        <div style="flex:1">
          <h3 class="aptv-section-title" style="color:#dc2626">COMPLAINTS</h3>
          ${complaints.map((c) => `<div class="aptv-feedback-item aptv-fb-neg">${esc(c)}</div>`).join("")}
        </div>` : ""}
      </div>
    </div>` : ""}

    ${clusters.length > 0 ? `
    <div class="aptv-section">
      <h3 class="aptv-section-title" style="color:#dc2626">SOCK PUPPET CLUSTERS</h3>
      ${clusters.map((cl) => `
        <div class="aptv-cluster">
          <div class="aptv-cluster-head">
            <span>CLUSTER</span>
            <span>${Math.round((cl["similarity"] as number) * 100)}% match</span>
          </div>
          <div class="aptv-cluster-tags">${(cl["accounts"] as string[]).map((a) => `<span class="aptv-tag-red">@${esc(a)}</span>`).join("")}</div>
          <p class="aptv-cluster-why">${esc((cl["sharedPatterns"] as string[]).join(", "))}</p>
        </div>`).join("")}
    </div>` : ""}

    ${commenters.length > 0 ? `
    <div class="aptv-section">
      <h3 class="aptv-section-title">COMMENTERS (${commenters.length})</h3>
      ${commenters.map((cm) => {
        const cred = (cm["credibilityScore"] as number) ?? 50;
        const sock = (cm["sockPuppetProbability"] as number) ?? 0;
        const chOnly = cm["channelSpecific"] as boolean;
        const sent = cm["sentiment"] as string ?? "neutral";
        const sentIcon = sent === "positive" ? "+" : sent === "negative" ? "−" : sent === "mixed" ? "±" : "•";
        const sentColor = sent === "positive" ? "#22c55e" : sent === "negative" ? "#dc2626" : sent === "mixed" ? "#f0b429" : "#64748b";
        const credColor = cred >= 70 ? "#22c55e" : cred >= 40 ? "#f0b429" : "#dc2626";
        return `
          <div class="aptv-commenter">
            <div class="aptv-commenter-top">
              <span style="color:${sentColor};font-weight:800;font-size:14px;margin-right:4px">${sentIcon}</span>
              <span class="aptv-commenter-name">@${esc(cm["username"])}</span>
              <span style="color:${credColor};font-weight:700;font-size:11px;margin-left:auto">${cred}</span>
            </div>
            <div class="aptv-commenter-flags">
              ${chOnly ? '<span class="aptv-flag-gold">Channel-Only</span>' : ""}
              ${sock > 30 ? `<span class="aptv-flag-red">Sock ${Math.round(sock)}%</span>` : ""}
              ${cred < 40 ? '<span class="aptv-flag-red">Low Credibility</span>' : ""}
            </div>
          </div>`;
      }).join("")}
    </div>` : ""}
  `;
}

function renderIntel(el: HTMLElement): void {
  const channel = currentData?.channel as Record<string, unknown> | null;
  const intel = currentData?.intel as Record<string, unknown> | null;

  if (!intel && !channel) {
    el.innerHTML = `<div class="aptv-empty">No channel intelligence available.<br><span class="aptv-sub">Channel research requires web search (Tavily API).</span></div>`;
    return;
  }

  let html = "";

  // APTV Tier Rating (if we have one)
  if (channel) {
    const tierColors: Record<string, [string, string]> = {
      "1": ["#22c55e", "The Real Ones"], "2": ["#3b82f6", "The Middle"],
      "3": ["#f97316", "Dingleberry"], "4": ["#dc2626", "Fraud"],
    };
    const tier = channel["tier"] as string;
    const [tColor, tName] = tierColors[tier] ?? ["#888", "Unknown"];

    html += `
    <div class="aptv-section">
      <h3 class="aptv-section-title">APTV RATING</h3>
      <div style="display:flex;align-items:center;gap:12px">
        <div class="aptv-gauges-row" style="margin:0">${svgGauge(channel["trustScore"] as number, "Trust", 80)}</div>
        ${tier ? `<div class="aptv-tier" style="border-color:${tColor};color:${tColor}">TIER ${tier}<br>${tName}</div>` : ""}
      </div>
      ${channel["tierReason"] ? `<p class="aptv-tier-reason">${channel["tierReason"]}</p>` : ""}
    </div>`;
  }

  if (intel) {
    const owner = intel["owner"] as Record<string, unknown> | null;
    const controversies = (intel["controversies"] as Record<string, unknown>[]) ?? [];
    const revenue = intel["revenue"] as Record<string, unknown> | null;
    const reputation = intel["reputation"] as Record<string, unknown> | null;
    const trust = intel["trustIndicators"] as Record<string, unknown> | null;
    const assessment = intel["overallAssessment"] as string ?? "";

    // Owner Profile
    if (owner) {
      const websites = (owner["websites"] as string[]) ?? [];
      const socials = (owner["socialLinks"] as string[]) ?? [];
      const knownFor = (owner["knownFor"] as string[]) ?? [];

      html += `
      <div class="aptv-section">
        <h3 class="aptv-section-title">OWNER PROFILE</h3>
        ${owner["name"] ? `<p style="font-size:14px;font-weight:700;color:#fff;margin:0 0 4px">${owner["name"]}</p>` : ""}
        ${owner["bio"] ? `<p style="font-size:11px;color:#999;line-height:1.5;margin:0 0 8px">${owner["bio"]}</p>` : ""}
        ${knownFor.length > 0 ? `<div class="aptv-tags" style="margin-bottom:8px">${knownFor.map((k) => `<span class="aptv-tag">${k}</span>`).join("")}</div>` : ""}
        ${websites.length > 0 ? `
          <div style="margin-top:6px">
            <span style="font-size:9px;color:#555;letter-spacing:1px">WEBSITES</span>
            ${websites.map((w) => `<a href="${w}" target="_blank" rel="noopener" class="aptv-link">${w.replace(/https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>`).join("")}
          </div>` : ""}
        ${socials.length > 0 ? `
          <div style="margin-top:6px">
            <span style="font-size:9px;color:#555;letter-spacing:1px">SOCIAL</span>
            <div class="aptv-tags">${socials.map((s) => `<span class="aptv-tag">${s}</span>`).join("")}</div>
          </div>` : ""}
      </div>`;
    }

    // Controversies
    if (controversies.length > 0) {
      const sevColors: Record<string, string> = { low: "#f0b429", medium: "#f97316", high: "#dc2626", critical: "#dc2626" };
      html += `
      <div class="aptv-section">
        <h3 class="aptv-section-title" style="color:#dc2626">CONTROVERSIES & RED FLAGS</h3>
        ${controversies.map((c) => {
          const sev = c["severity"] as string;
          const sevColor = sevColors[sev] ?? "#888";
          return `
            <div class="aptv-controversy">
              <div class="aptv-controversy-head">
                <span style="color:${sevColor};font-weight:700;font-size:11px">${(sev ?? "").toUpperCase()}</span>
                <span style="font-size:12px;color:#ddd;font-weight:600">${c["title"]}</span>
              </div>
              <p style="font-size:11px;color:#888;margin:4px 0 0;line-height:1.4">${c["summary"]}</p>
              ${c["source"] ? `<span style="font-size:9px;color:#555">${c["source"]}</span>` : ""}
            </div>`;
        }).join("")}
      </div>`;
    }

    // Revenue
    if (revenue) {
      const streams = (revenue["revenueStreams"] as string[]) ?? [];
      const products = (revenue["paidProducts"] as string[]) ?? [];
      html += `
      <div class="aptv-section">
        <h3 class="aptv-section-title">REVENUE ANALYSIS</h3>
        ${revenue["estimatedMonthlyViews"] ? `<p style="font-size:11px;color:#999;margin:0 0 8px">Est. Monthly Views: <strong style="color:#fff">${revenue["estimatedMonthlyViews"]}</strong></p>` : ""}
        ${streams.length > 0 ? `
          <div style="margin-bottom:8px">
            <span style="font-size:9px;color:#555;letter-spacing:1px">REVENUE STREAMS</span>
            <div class="aptv-tags">${streams.map((s) => `<span class="aptv-tag">${s}</span>`).join("")}</div>
          </div>` : ""}
        ${products.length > 0 ? `
          <div style="margin-bottom:8px">
            <span style="font-size:9px;color:#555;letter-spacing:1px">PAID PRODUCTS</span>
            <div class="aptv-tags">${products.map((p) => `<span class="aptv-tag aptv-tag-gold">${p}</span>`).join("")}</div>
          </div>` : ""}
        <div class="aptv-stat-pills">
          <span class="aptv-pill ${revenue["affiliateLinks"] ? "aptv-pill-danger" : ""}">Affiliates: ${revenue["affiliateLinks"] ? "Yes" : "No"}</span>
          <span class="aptv-pill">Sponsors: ${revenue["sponsorships"] ? "Yes" : "No"}</span>
        </div>
      </div>`;
    }

    // Trust Indicators
    if (trust) {
      const positive = (trust["positive"] as string[]) ?? [];
      const negative = (trust["negative"] as string[]) ?? [];
      html += `
      <div class="aptv-section">
        <h3 class="aptv-section-title">TRUST INDICATORS</h3>
        ${positive.length > 0 ? `
          <div style="margin-bottom:8px">
            ${positive.map((p) => `<div class="aptv-trust-item aptv-trust-pos"><span class="aptv-trust-icon">&#10003;</span>${p}</div>`).join("")}
          </div>` : ""}
        ${negative.length > 0 ? `
          <div>
            ${negative.map((n) => `<div class="aptv-trust-item aptv-trust-neg"><span class="aptv-trust-icon">&#10007;</span>${n}</div>`).join("")}
          </div>` : ""}
      </div>`;
    }

    // Reputation
    if (reputation) {
      const redditMentions = (reputation["redditMentions"] as string[]) ?? [];
      const peerOpinions = (reputation["peerOpinions"] as string[]) ?? [];
      html += `
      <div class="aptv-section">
        <h3 class="aptv-section-title">COMMUNITY REPUTATION</h3>
        ${reputation["communityPerception"] ? `<p style="font-size:12px;color:#ccc;line-height:1.5;margin:0 0 8px">${reputation["communityPerception"]}</p>` : ""}
        ${redditMentions.length > 0 ? `
          <div style="margin-bottom:8px">
            <span style="font-size:9px;color:#555;letter-spacing:1px">REDDIT</span>
            ${redditMentions.map((r) => `<p style="font-size:11px;color:#888;margin:2px 0;border-left:2px solid #dc2626;padding-left:8px">${r}</p>`).join("")}
          </div>` : ""}
        ${peerOpinions.length > 0 ? `
          <div>
            <span style="font-size:9px;color:#555;letter-spacing:1px">PEER OPINIONS</span>
            ${peerOpinions.map((p) => `<p style="font-size:11px;color:#888;margin:2px 0;border-left:2px solid #f0b429;padding-left:8px">${p}</p>`).join("")}
          </div>` : ""}
      </div>`;
    }

    // Overall Assessment
    if (assessment) {
      html += `
      <div class="aptv-section">
        <h3 class="aptv-section-title">OVERALL ASSESSMENT</h3>
        <p style="font-size:12px;color:#ccc;line-height:1.6;margin:0;padding:10px;background:#0a0a0a;border-radius:8px;border-left:3px solid #f0b429">${assessment}</p>
      </div>`;
    }

    // Channel Stats from YouTube API
    const stats = intel?.["channelStats"] as Record<string, unknown> | null;
    if (stats) {
      const totalViews = Number(stats["totalViews"] ?? 0);
      const subs = Number(stats["subscriberCount"] ?? 0);
      const videos = Number(stats["videoCount"] ?? 0);
      const joinDate = stats["joinDate"] ? new Date(stats["joinDate"] as string).toLocaleDateString("en-US", { year: "numeric", month: "long" }) : "";
      const country = stats["country"] as string ?? "";
      const keywords = (stats["keywords"] as string[]) ?? [];
      const links = (stats["links"] as { title: string; url: string }[]) ?? [];
      const socials = (stats["socials"] as { platform: string; url: string }[]) ?? [];
      const websiteUrl = stats["websiteUrl"] as string ?? "";
      const websiteDesc = stats["websiteDescription"] as string ?? "";

      html += `
      <div class="aptv-section">
        <h3 class="aptv-section-title">CHANNEL STATS</h3>
        <div class="aptv-stats-grid">
          <div class="aptv-stat-card"><span class="aptv-stat-val">${subs.toLocaleString()}</span><span class="aptv-stat-lbl">Subscribers</span></div>
          <div class="aptv-stat-card"><span class="aptv-stat-val">${totalViews.toLocaleString()}</span><span class="aptv-stat-lbl">Total Views</span></div>
          <div class="aptv-stat-card"><span class="aptv-stat-val">${videos.toLocaleString()}</span><span class="aptv-stat-lbl">Videos</span></div>
          <div class="aptv-stat-card"><span class="aptv-stat-val">${joinDate || "—"}</span><span class="aptv-stat-lbl">Joined</span></div>
        </div>
        ${country ? `<div class="aptv-stat-pills" style="margin-top:8px"><span class="aptv-pill">${esc(country)}</span></div>` : ""}
      </div>`;

      if (socials.length > 0) {
        html += `
        <div class="aptv-section">
          <h3 class="aptv-section-title">CONNECTED ACCOUNTS</h3>
          ${socials.map((s) => `
            <a href="${esc(s.url)}" target="_blank" rel="noopener" class="aptv-social-link">
              <span class="aptv-social-platform">${esc(s.platform.toUpperCase())}</span>
              <span class="aptv-social-url">${esc(s.url.replace(/https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</span>
            </a>
          `).join("")}
        </div>`;
      }

      if (links.length > 0) {
        html += `
        <div class="aptv-section">
          <h3 class="aptv-section-title">LINKED WEBSITES</h3>
          ${links.filter((l) => !l.url.includes("youtube.com")).map((l) => `
            <a href="${esc(l.url)}" target="_blank" rel="noopener" class="aptv-social-link">
              <span class="aptv-social-platform">${esc(l.title)}</span>
              <span class="aptv-social-url">${esc(l.url.replace(/https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</span>
            </a>
          `).join("")}
          ${websiteUrl && websiteDesc ? `<p style="font-size:11px;color:#888;margin-top:6px;line-height:1.4">${esc(websiteDesc)}</p>` : ""}
        </div>`;
      }

      if (keywords.length > 0) {
        html += `
        <div class="aptv-section">
          <h3 class="aptv-section-title">CHANNEL KEYWORDS</h3>
          <div class="aptv-tags">${keywords.map((k) => `<span class="aptv-tag">${esc(k)}</span>`).join("")}</div>
        </div>`;
      }
    }
  }

  el.innerHTML = html || `<div class="aptv-empty">No intelligence data</div>`;
}

function renderSources(el: HTMLElement): void {
  const sources = currentData?.sources as Record<string, unknown> | null;
  if (!sources) {
    el.innerHTML = `<div class="aptv-empty">No source analysis available.</div>`;
    return;
  }

  const originalityScore = sources["originalityScore"] as number ?? 0;
  const verdict = sources["verdict"] as string ?? "";
  const matching = (sources["matchingSources"] as Record<string, unknown>[]) ?? [];
  const cited = (sources["citedSources"] as Record<string, unknown>[]) ?? [];

  el.innerHTML = `
    <div class="aptv-section">
      <div class="aptv-gauges-row" style="justify-content:center">
        ${svgGauge(originalityScore, "Originality", 120)}
      </div>
      ${verdict ? `<p style="font-size:12px;color:#ccc;text-align:center;line-height:1.5;margin:8px 0">${esc(verdict)}</p>` : ""}
    </div>

    ${matching.length > 0 ? `
    <div class="aptv-section">
      <h3 class="aptv-section-title">MATCHING CONTENT</h3>
      ${matching.map((m) => `
        <div class="aptv-source-card">
          <div class="aptv-source-header">
            <a href="${esc(m["url"])}" target="_blank" rel="noopener" class="aptv-link" style="font-weight:600">${esc(m["title"])}</a>
            <span class="aptv-match-pct">${m["matchPercentage"] ?? 0}%</span>
          </div>
          <p style="font-size:11px;color:#888;margin:4px 0 0;line-height:1.4">${esc(m["snippet"])}</p>
          <span class="aptv-source-type">${esc(m["type"])}</span>
        </div>
      `).join("")}
    </div>` : ""}

    ${cited.length > 0 ? `
    <div class="aptv-section">
      <h3 class="aptv-section-title">CITED SOURCES</h3>
      ${cited.map((c) => `
        <a href="${esc(c["url"])}" target="_blank" rel="noopener" class="aptv-source-card" style="display:block;text-decoration:none">
          <span class="aptv-link" style="font-weight:600">${esc(c["title"])}</span>
          <p style="font-size:11px;color:#888;margin:4px 0 0;line-height:1.4">${esc(c["snippet"])}</p>
        </a>
      `).join("")}
    </div>` : ""}

    ${matching.length === 0 && cited.length === 0 ? `
    <div class="aptv-empty">No matching sources found — content appears original.</div>
    ` : ""}
  `;
}

function renderStats(el: HTMLElement): void {
  // Scrape everything available from the YouTube page
  const viewsText = document.querySelector("#info-strings yt-formatted-string")?.textContent?.trim() ?? "";
  const viewNum = parseInt(viewsText.replace(/[^0-9]/g, ""), 10) || 0;
  const subCount = document.querySelector("#owner-sub-count")?.textContent?.trim() ?? "";

  // Likes
  const likeBtn = document.querySelector("#top-level-buttons-computed segmented-like-dislike-button-view-model button, #top-level-buttons-computed button");
  const likeLabel = likeBtn?.getAttribute("aria-label") ?? "";
  const likeNum = parseInt(likeLabel.replace(/[^0-9]/g, ""), 10) || 0;

  // Comment count
  const commentHeader = document.querySelector("#comments #count yt-formatted-string");
  const commentCount = commentHeader?.textContent?.trim().replace(/[^0-9,]/g, "") ?? "";

  // Publish date
  const dateEl = document.querySelector("#info-strings yt-formatted-string");
  const publishDate = dateEl?.textContent?.trim() ?? "";

  // Duration from video element
  const videoEl = document.querySelector("video");
  const duration = videoEl?.duration ?? 0;
  const durationStr = duration > 0 ? `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, "0")}` : "";

  // Category from meta
  const metaGenre = document.querySelector('meta[itemprop="genre"]');
  const category = metaGenre?.getAttribute("content") ?? "";

  // Tags
  const metaKeywords = document.querySelector('meta[name="keywords"]');
  const tags = metaKeywords?.getAttribute("content")?.split(",").map((t) => t.trim()).filter(Boolean) ?? [];

  // Description
  const descEl = document.querySelector("#description-inline-expander");
  const desc = descEl?.textContent?.trim() ?? "";
  const hashtags = desc.match(/#\w+/g) ?? [];

  // Links in description
  const descLinks: string[] = [];
  document.querySelectorAll("#description-inline-expander a").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    const text = a.textContent?.trim() ?? "";
    if (href && text && !href.includes("youtube.com/hashtag") && text.length > 3) {
      descLinks.push(text);
    }
  });

  // Chapters
  const chapters: string[] = [];
  document.querySelectorAll("ytd-macro-markers-list-item-renderer h4").forEach((ch) => {
    const text = ch.textContent?.trim();
    if (text) chapters.push(text);
  });

  // Engagement calculations
  let engagementRate = "—";
  let engagementGrade = "";
  if (viewNum > 0 && likeNum > 0) {
    const rate = (likeNum / viewNum) * 100;
    engagementGrade = rate >= 8 ? "Exceptional" : rate >= 5 ? "Excellent" : rate >= 3 ? "Good" : rate >= 1.5 ? "Average" : "Low";
    engagementRate = `${rate.toFixed(2)}%`;
  }

  // SEO analysis
  const titleEl = document.querySelector("yt-formatted-string.ytd-watch-metadata");
  const titleText = titleEl?.textContent?.trim() ?? "";
  const titleLen = titleText.length;
  const descLen = desc.length;
  const titleScore = titleLen >= 40 && titleLen <= 70 ? "Good" : titleLen < 40 ? "Too short" : "Too long";
  const descScore = descLen >= 200 ? "Good" : descLen >= 100 ? "Fair" : "Too short";
  const tagScore = tags.length >= 5 ? "Good" : tags.length >= 2 ? "Fair" : "Needs more";

  el.innerHTML = `
    <div class="aptv-section">
      <h3 class="aptv-section-title">VIDEO PERFORMANCE</h3>
      <div class="aptv-stats-grid">
        <div class="aptv-stat-card"><span class="aptv-stat-val">${viewNum > 0 ? viewNum.toLocaleString() : viewsText || "—"}</span><span class="aptv-stat-lbl">Views</span></div>
        <div class="aptv-stat-card"><span class="aptv-stat-val">${likeNum > 0 ? likeNum.toLocaleString() : "—"}</span><span class="aptv-stat-lbl">Likes</span></div>
        <div class="aptv-stat-card"><span class="aptv-stat-val">${commentCount || "—"}</span><span class="aptv-stat-lbl">Comments</span></div>
        <div class="aptv-stat-card"><span class="aptv-stat-val">${subCount || "—"}</span><span class="aptv-stat-lbl">Subscribers</span></div>
      </div>
    </div>

    <div class="aptv-section">
      <h3 class="aptv-section-title">ENGAGEMENT</h3>
      <div class="aptv-gauges-row" style="justify-content:center">
        ${viewNum > 0 && likeNum > 0 ? svgGauge(Math.min((likeNum / viewNum) * 100 * 10, 100), "Like Rate", 100) : ""}
      </div>
      <div class="aptv-stat-pills" style="justify-content:center">
        <span class="aptv-pill">${engagementRate} engagement</span>
        ${engagementGrade ? `<span class="aptv-pill ${engagementGrade === "Low" ? "aptv-pill-danger" : ""}">${engagementGrade}</span>` : ""}
      </div>
    </div>

    <div class="aptv-section">
      <h3 class="aptv-section-title">VIDEO INFO</h3>
      <div class="aptv-stats-grid">
        <div class="aptv-stat-card"><span class="aptv-stat-val">${publishDate || "—"}</span><span class="aptv-stat-lbl">Published</span></div>
        <div class="aptv-stat-card"><span class="aptv-stat-val">${durationStr || "—"}</span><span class="aptv-stat-lbl">Duration</span></div>
        ${category ? `<div class="aptv-stat-card"><span class="aptv-stat-val">${esc(category)}</span><span class="aptv-stat-lbl">Category</span></div>` : ""}
      </div>
    </div>

    <div class="aptv-section">
      <h3 class="aptv-section-title">SEO ANALYSIS</h3>
      <div class="aptv-seo-grid">
        <div class="aptv-seo-item">
          <span class="aptv-seo-label">Title Length</span>
          <span class="aptv-seo-val">${titleLen} chars</span>
          <span class="aptv-seo-grade ${titleScore === "Good" ? "aptv-seo-good" : "aptv-seo-warn"}">${titleScore}</span>
        </div>
        <div class="aptv-seo-item">
          <span class="aptv-seo-label">Description</span>
          <span class="aptv-seo-val">${descLen} chars</span>
          <span class="aptv-seo-grade ${descScore === "Good" ? "aptv-seo-good" : "aptv-seo-warn"}">${descScore}</span>
        </div>
        <div class="aptv-seo-item">
          <span class="aptv-seo-label">Tags</span>
          <span class="aptv-seo-val">${tags.length} tags</span>
          <span class="aptv-seo-grade ${tagScore === "Good" ? "aptv-seo-good" : "aptv-seo-warn"}">${tagScore}</span>
        </div>
        <div class="aptv-seo-item">
          <span class="aptv-seo-label">Hashtags</span>
          <span class="aptv-seo-val">${hashtags.length} found</span>
          <span class="aptv-seo-grade ${hashtags.length > 0 ? "aptv-seo-good" : "aptv-seo-warn"}">${hashtags.length > 0 ? "Yes" : "None"}</span>
        </div>
        ${chapters.length > 0 ? `
        <div class="aptv-seo-item">
          <span class="aptv-seo-label">Chapters</span>
          <span class="aptv-seo-val">${chapters.length} chapters</span>
          <span class="aptv-seo-grade aptv-seo-good">Good</span>
        </div>` : `
        <div class="aptv-seo-item">
          <span class="aptv-seo-label">Chapters</span>
          <span class="aptv-seo-val">None</span>
          <span class="aptv-seo-grade aptv-seo-warn">Missing</span>
        </div>`}
      </div>
    </div>

    ${tags.length > 0 ? `
    <div class="aptv-section">
      <h3 class="aptv-section-title">TAGS (${tags.length})</h3>
      <div class="aptv-tags">${tags.map((t) => `<span class="aptv-tag">${esc(t)}</span>`).join("")}</div>
    </div>` : ""}

    ${hashtags.length > 0 ? `
    <div class="aptv-section">
      <h3 class="aptv-section-title">HASHTAGS</h3>
      <div class="aptv-tags">${hashtags.map((h) => `<span class="aptv-tag aptv-tag-gold">${esc(h)}</span>`).join("")}</div>
    </div>` : ""}

    ${descLinks.length > 0 ? `
    <div class="aptv-section">
      <h3 class="aptv-section-title">LINKS IN DESCRIPTION (${descLinks.length})</h3>
      <div class="aptv-tags">${descLinks.map((l) => `<span class="aptv-tag">${esc(l)}</span>`).join("")}</div>
    </div>` : ""}

    ${chapters.length > 0 ? `
    <div class="aptv-section">
      <h3 class="aptv-section-title">CHAPTERS (${chapters.length})</h3>
      <div style="display:flex;flex-direction:column;gap:2px">
        ${chapters.map((ch, i) => `<span style="font-size:11px;color:#ccc;padding:3px 0;border-bottom:1px solid #111">${i + 1}. ${esc(ch)}</span>`).join("")}
      </div>
    </div>` : ""}

    ${desc ? `
    <div class="aptv-section">
      <h3 class="aptv-section-title">DESCRIPTION</h3>
      <p style="font-size:11px;color:#aaa;line-height:1.5;white-space:pre-wrap">${esc(desc.substring(0, 600))}${desc.length > 600 ? "..." : ""}</p>
    </div>` : ""}
  `;
}

// ── Video Detection ─────────────────────────────────────────────────────────

function extractVideoId(): string | null {
  return new URL(window.location.href).searchParams.get("v");
}

function onVideoChange(): void {
  const videoId = extractVideoId();
  if (!videoId || videoId === currentVideoId) return;
  currentVideoId = videoId;
  const content = document.getElementById("aptv-content");
  if (content) {
    const cached = analysisCache[videoId];
    if (cached) { renderAnalysis(cached); } else {
      content.innerHTML = `
        <div id="aptv-empty-state">
          <img src="${getExtUrl("aptv_logo.png")}" style="width:140px;height:140px;border-radius:16px;margin-bottom:12px" />
          <p style="font-size:14px;font-weight:600;color:#fff">Ready to fact-check</p>
          <p style="font-size:12px;color:#888">Works on any channel, any niche</p>
          <button id="aptv-analyze-btn">ANALYZE THIS VIDEO</button>
          <p class="aptv-tagline">Every niche. Every channel. Graded.</p>
        </div>`;
      document.getElementById("aptv-analyze-btn")?.addEventListener("click", runAnalysis);
    }
  }
  const badge = document.getElementById("aptv-grade-badge");
  if (badge) badge.innerHTML = "";
  document.getElementById("aptv-inline-badge")?.remove();
}

// ── Init ────────────────────────────────────────────────────────────────────

// ── Export System ────────────────────────────────────────────────────────────

function exportData(format: string): void {
  if (!currentData?.video) {
    alert("No analysis data to export. Analyze a video first.");
    return;
  }

  const video = currentData.video as Record<string, unknown>;
  const claims = (video["claims"] as Record<string, unknown>[]) ?? [];
  const comments = currentData.comments as Record<string, unknown> | null;
  const intel = currentData.intel as Record<string, unknown> | null;
  const title = (video["title"] as string) ?? document.title.replace(/ - YouTube$/, "");
  const grade = (video["grade"] as string) ?? "?";
  const creator = scrapeCreatorInfo();

  let output = "";
  let filename = `aptv-${currentVideoId}`;

  switch (format) {
    case "summary":
      output = exportSummary(title, grade, video, claims, creator);
      copyToClipboard(output, "Summary copied!");
      return;

    case "text":
      output = exportFullText(title, grade, video, claims, comments, intel, creator);
      filename += ".txt";
      break;

    case "thread":
      output = exportThread(title, grade, video, claims, creator);
      copyToClipboard(output, "Thread copied!");
      return;

    case "markdown":
      output = exportMarkdown(title, grade, video, claims, comments, intel, creator);
      filename += ".md";
      break;

    case "json":
      output = JSON.stringify(currentData, null, 2);
      filename += ".json";
      break;

    case "csv":
      output = exportCsv(claims);
      filename += ".csv";
      break;

    default:
      return;
  }

  downloadFile(output, filename, format === "json" ? "application/json" : "text/plain");
}

function copyToClipboard(text: string, _successMsg: string): void {
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById("aptv-export-btn");
    if (btn) { const orig = btn.textContent; btn.textContent = "✓"; setTimeout(() => { btn.textContent = orig; }, 1500); }
  });
}

function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportSummary(title: string, grade: string, video: Record<string, unknown>, claims: Record<string, unknown>[], creator: { name: string }): string {
  const falseCount = claims.filter((c) => c["verdict"] === "false").length;
  const verifiedCount = claims.filter((c) => c["verdict"] === "verified").length;
  const bs = Math.round((video["bsMeter"] as number) ?? 0);
  const accuracy = Math.round((video["accuracy"] as number) ?? 0);

  return [
    `APTV Fact Check: ${grade}`,
    `"${title}" by ${creator.name}`,
    `Accuracy: ${accuracy}% | BS: ${bs}% | ${verifiedCount} verified, ${falseCount} false claims`,
    ``,
    `Analyzed by APTV Fact Check — advantageplayertv.com`,
  ].join("\n");
}

function exportThread(title: string, grade: string, video: Record<string, unknown>, claims: Record<string, unknown>[], creator: { name: string }): string {
  const falseClaims = claims.filter((c) => c["verdict"] === "false");
  const summary = (video["summary"] as string[]) ?? [];
  const bs = Math.round((video["bsMeter"] as number) ?? 0);

  const tweets: string[] = [];

  tweets.push(`APTV Fact Check: "${title}" by ${creator.name}\n\nGrade: ${grade}\nBS Meter: ${bs}%\n\nHere's what we found 🧵👇`);

  if (summary.length > 0) {
    tweets.push(`SUMMARY:\n${summary.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
  }

  if (falseClaims.length > 0) {
    tweets.push(`🚨 FALSE CLAIMS FOUND (${falseClaims.length}):`);
    for (const c of falseClaims.slice(0, 4)) {
      tweets.push(`❌ "${c["text"]}"\n\nFACT: ${c["evidence"]}`);
    }
  }

  const verifiedCount = claims.filter((c) => c["verdict"] === "verified").length;
  if (verifiedCount > 0) {
    tweets.push(`✅ ${verifiedCount} claims were verified as accurate.`);
  }

  tweets.push(`Full analysis by @AdvantagePlayerTV\n\nEvery niche. Every channel. Graded.\n\n#APTV #FactCheck #YouTube`);

  return tweets.map((t, i) => `${i + 1}/${tweets.length}\n${t}`).join("\n\n---\n\n");
}

function exportFullText(title: string, grade: string, video: Record<string, unknown>, claims: Record<string, unknown>[], comments: Record<string, unknown> | null, intel: Record<string, unknown> | null, creator: { name: string }): string {
  const lines: string[] = [];
  const accuracy = Math.round((video["accuracy"] as number) ?? 0);
  const bs = Math.round((video["bsMeter"] as number) ?? 0);
  const clickbait = Math.round((video["clickbait"] as number) ?? 0);
  const originality = Math.round((video["originality"] as number) ?? 0);
  const value = Math.round((video["valueDelivered"] as number) ?? 0);
  const summary = (video["summary"] as string[]) ?? [];

  lines.push("═══════════════════════════════════════════════════════");
  lines.push("  APTV FACT CHECK REPORT");
  lines.push("═══════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`Video:    ${title}`);
  lines.push(`Channel:  ${creator.name}`);
  lines.push(`Grade:    ${grade}`);
  lines.push(`Video ID: ${currentVideoId}`);
  lines.push(`Date:     ${new Date().toLocaleDateString()}`);
  lines.push("");

  lines.push("── SCORES ─────────────────────────────────────────────");
  lines.push(`  Accuracy:       ${accuracy}%`);
  lines.push(`  BS Meter:       ${bs}%`);
  lines.push(`  Clickbait:      ${clickbait}%`);
  lines.push(`  Originality:    ${originality}%`);
  lines.push(`  Value:          ${value}%`);
  lines.push("");

  if (summary.length > 0) {
    lines.push("── SUMMARY ────────────────────────────────────────────");
    summary.forEach((s) => lines.push(`  • ${s}`));
    lines.push("");
  }

  const falseClaims = claims.filter((c) => c["verdict"] === "false");
  const verifiedClaims = claims.filter((c) => c["verdict"] === "verified");
  const unverifiedClaims = claims.filter((c) => c["verdict"] === "unverified");

  lines.push(`── CLAIMS (${claims.length} total) ─────────────────────────────────`);
  lines.push(`  Verified:   ${verifiedClaims.length}`);
  lines.push(`  False:      ${falseClaims.length}`);
  lines.push(`  Unverified: ${unverifiedClaims.length}`);
  lines.push("");

  if (falseClaims.length > 0) {
    lines.push("── FALSE CLAIMS ───────────────────────────────────────");
    falseClaims.forEach((c, i) => {
      lines.push(`  ${i + 1}. "${c["text"]}"`);
      lines.push(`     EVIDENCE: ${c["evidence"]}`);
      if (c["timestamp"]) lines.push(`     TIMESTAMP: ${c["timestamp"]}`);
      lines.push("");
    });
  }

  if (verifiedClaims.length > 0) {
    lines.push("── VERIFIED CLAIMS ────────────────────────────────────");
    verifiedClaims.forEach((c, i) => {
      lines.push(`  ${i + 1}. "${c["text"]}"`);
      lines.push(`     ${c["evidence"]}`);
      lines.push("");
    });
  }

  if (comments) {
    const sentiment = comments["sentiment"] as Record<string, number> | null;
    const sentScore = (comments["sentimentScore"] as number) ?? 0;
    const praises = (comments["topPraises"] as string[]) ?? [];
    const complaints = (comments["topComplaints"] as string[]) ?? [];

    lines.push("── COMMENT SENTIMENT ──────────────────────────────────");
    lines.push(`  Sentiment Score: ${sentScore}/100`);
    if (sentiment) {
      lines.push(`  Positive: ${sentiment.positive}% | Negative: ${sentiment.negative}% | Neutral: ${sentiment.neutral}% | Mixed: ${sentiment.mixed}%`);
    }
    if (praises.length > 0) { lines.push(`  Praises: ${praises.join(", ")}`); }
    if (complaints.length > 0) { lines.push(`  Complaints: ${complaints.join(", ")}`); }
    lines.push("");
  }

  if (intel) {
    const assessment = (intel["overallAssessment"] as string) ?? "";
    const controversies = (intel["controversies"] as Record<string, unknown>[]) ?? [];

    lines.push("── CHANNEL INTELLIGENCE ───────────────────────────────");
    if (assessment) lines.push(`  ${assessment}`);
    lines.push("");

    if (controversies.length > 0) {
      lines.push("  Controversies:");
      controversies.forEach((c) => {
        lines.push(`    [${(c["severity"] as string ?? "").toUpperCase()}] ${c["title"]}`);
        lines.push(`    ${c["summary"]}`);
        lines.push("");
      });
    }
  }

  lines.push("═══════════════════════════════════════════════════════");
  lines.push("  Generated by APTV Fact Check — advantageplayertv.com");
  lines.push("  Every niche. Every channel. Graded.");
  lines.push("═══════════════════════════════════════════════════════");

  return lines.join("\n");
}

function exportMarkdown(title: string, grade: string, video: Record<string, unknown>, claims: Record<string, unknown>[], comments: Record<string, unknown> | null, intel: Record<string, unknown> | null, creator: { name: string }): string {
  const lines: string[] = [];
  const accuracy = Math.round((video["accuracy"] as number) ?? 0);
  const bs = Math.round((video["bsMeter"] as number) ?? 0);
  const clickbait = Math.round((video["clickbait"] as number) ?? 0);
  const originality = Math.round((video["originality"] as number) ?? 0);
  const value = Math.round((video["valueDelivered"] as number) ?? 0);
  const summary = (video["summary"] as string[]) ?? [];

  lines.push(`# APTV Fact Check Report`);
  lines.push("");
  lines.push(`**Video:** ${title}`);
  lines.push(`**Channel:** ${creator.name}`);
  lines.push(`**Grade:** ${grade}`);
  lines.push(`**Date:** ${new Date().toLocaleDateString()}`);
  lines.push("");

  lines.push("## Scores");
  lines.push("");
  lines.push("| Metric | Score |");
  lines.push("|--------|-------|");
  lines.push(`| Accuracy | ${accuracy}% |`);
  lines.push(`| BS Meter | ${bs}% |`);
  lines.push(`| Clickbait | ${clickbait}% |`);
  lines.push(`| Originality | ${originality}% |`);
  lines.push(`| Value Delivered | ${value}% |`);
  lines.push("");

  if (summary.length > 0) {
    lines.push("## Summary");
    summary.forEach((s) => lines.push(`- ${s}`));
    lines.push("");
  }

  const falseClaims = claims.filter((c) => c["verdict"] === "false");
  const verifiedClaims = claims.filter((c) => c["verdict"] === "verified");

  lines.push(`## Claims (${claims.length} total)`);
  lines.push("");
  lines.push(`- **Verified:** ${verifiedClaims.length}`);
  lines.push(`- **False:** ${falseClaims.length}`);
  lines.push(`- **Unverified:** ${claims.length - falseClaims.length - verifiedClaims.length}`);
  lines.push("");

  if (falseClaims.length > 0) {
    lines.push("### False Claims");
    lines.push("");
    falseClaims.forEach((c, i) => {
      lines.push(`${i + 1}. > "${c["text"]}"`);
      lines.push(`   **Evidence:** ${c["evidence"]}`);
      lines.push("");
    });
  }

  if (comments) {
    const sentScore = (comments["sentimentScore"] as number) ?? 0;
    const praises = (comments["topPraises"] as string[]) ?? [];
    const complaints = (comments["topComplaints"] as string[]) ?? [];
    lines.push("## Comment Sentiment");
    lines.push(`**Score:** ${sentScore}/100`);
    if (praises.length > 0) lines.push(`**Praises:** ${praises.join(", ")}`);
    if (complaints.length > 0) lines.push(`**Complaints:** ${complaints.join(", ")}`);
    lines.push("");
  }

  if (intel) {
    const assessment = (intel["overallAssessment"] as string) ?? "";
    lines.push("## Channel Intelligence");
    if (assessment) lines.push(assessment);
    lines.push("");
  }

  lines.push("---");
  lines.push("*Generated by [APTV Fact Check](https://advantageplayertv.com)*");

  return lines.join("\n");
}

function exportCsv(claims: Record<string, unknown>[]): string {
  const lines: string[] = [];
  lines.push("Claim,Verdict,Timestamp,Evidence");

  for (const c of claims) {
    const text = String(c["text"] ?? "").replace(/"/g, '""');
    const verdict = String(c["verdict"] ?? "");
    const timestamp = String(c["timestamp"] ?? "");
    const evidence = String(c["evidence"] ?? "").replace(/"/g, '""');
    lines.push(`"${text}","${verdict}","${timestamp}","${evidence}"`);
  }

  return lines.join("\n");
}

function init(): void {
  injectStyles();
  createPanel();
  createToggleButton();
  currentVideoId = extractVideoId();

  // YouTube SPA detection — poll URL every second (most reliable)
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      // Force reset when URL changes
      currentVideoId = null;
      currentData = null;
      const badge = document.getElementById("aptv-grade-badge");
      if (badge) badge.innerHTML = "";
      document.getElementById("aptv-inline-badge")?.remove();
      setTimeout(onVideoChange, 800);
    }
  }, 1000);

  // Also listen for YouTube's own navigation event
  window.addEventListener("yt-navigate-finish", () => {
    currentVideoId = null;
    currentData = null;
    setTimeout(onVideoChange, 800);
  });

  chrome.runtime.onMessage.addListener((message: { type: string }) => {
    if (message.type === "TOGGLE_PANEL") togglePanel();
  });

  // Scan thumbnails for grade badges every 5 seconds
  setInterval(scanThumbnails, 5000);
  setTimeout(scanThumbnails, 3000);
}

// ── Thumbnail Grade Badges ──────────────────────────────────────────────────

let lastThumbnailScan = 0;
const scannedThumbnails = new Set<string>();

async function scanThumbnails(): Promise<void> {
  // Don't scan more than once per 5 seconds
  if (Date.now() - lastThumbnailScan < 4000) return;
  lastThumbnailScan = Date.now();

  // Find all video thumbnail links on the page
  const links = document.querySelectorAll("a#thumbnail[href*='watch?v='], a.ytd-thumbnail[href*='watch?v=']");
  const videoIds: string[] = [];

  links.forEach((link) => {
    const href = link.getAttribute("href") ?? "";
    const match = href.match(/[?&]v=([^&]+)/);
    if (match?.[1] && !scannedThumbnails.has(match[1])) {
      videoIds.push(match[1]);
    }
  });

  if (videoIds.length === 0) return;

  try {
    const resp = await fetch(`${API_BASE}/api/v1/grades/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoIds: videoIds.slice(0, 50) }),
    });

    if (!resp.ok) return;
    const data = (await resp.json()) as { grades: Record<string, string> };

    // Mark all as scanned even if no grade
    videoIds.forEach((id) => scannedThumbnails.add(id));

    // Inject badges
    for (const [videoId, grade] of Object.entries(data.grades)) {
      links.forEach((link) => {
        const href = link.getAttribute("href") ?? "";
        if (href.includes(videoId) && !link.querySelector(".aptv-thumb-badge")) {
          const badge = document.createElement("div");
          badge.className = `aptv-thumb-badge aptv-grade-${grade.toLowerCase()}`;
          badge.textContent = grade;
          badge.title = `APTV Grade: ${grade}`;
          (link as HTMLElement).style.position = "relative";
          link.appendChild(badge);
        }
      });
    }
  } catch {
    // Silent fail — thumbnails are a nice-to-have
  }
}

// ── Styles ──────────────────────────────────────────────────────────────────

function injectStyles(): void {
  if (document.getElementById("aptv-styles")) return;
  const style = document.createElement("style");
  style.id = "aptv-styles";
  style.textContent = `
    /* ── APTV Brand: Black / Red / White / Gold ── */

    #aptv-toggle {
      position:fixed; bottom:20px; right:20px; width:52px; height:52px;
      border-radius:12px; background:#000; border:2px solid #f0b429;
      cursor:pointer; z-index:9999; display:flex; align-items:center; justify-content:center;
      box-shadow:0 4px 24px rgba(0,0,0,0.6), 0 0 12px rgba(240,180,41,0.2);
      transition:transform 0.2s, box-shadow 0.2s;
    }
    #aptv-toggle:hover { transform:scale(1.1); box-shadow:0 4px 32px rgba(240,180,41,0.4); }

    #aptv-panel {
      position:fixed; top:0; right:-420px; width:410px; height:100vh;
      background:#000; border-left:2px solid #b91c1c; z-index:9998;
      transition:right 0.3s ease; overflow:hidden;
      font-family:"Inter",-apple-system,BlinkMacSystemFont,sans-serif; color:#e5e5e5;
    }
    #aptv-panel.aptv-visible { right:0; }
    #aptv-panel-inner { display:flex; flex-direction:column; height:100%; }

    /* ── Header ── */
    #aptv-header {
      display:flex; align-items:center; gap:10px; padding:10px 14px;
      background:linear-gradient(135deg, #000 0%, #1a0000 100%);
      border-bottom:2px solid #b91c1c;
    }
    #aptv-brand { display:flex; align-items:center; gap:10px; flex:1; }
    #aptv-logo { width:56px; height:56px; border-radius:10px; }
    #aptv-brand-text { display:flex; flex-direction:column; }
    #aptv-brand-name { font-size:11px; font-weight:800; letter-spacing:1.5px; color:#f0b429; }
    #aptv-brand-sub { font-size:9px; font-weight:600; letter-spacing:2px; color:#dc2626; }
    /* ── Export Menu ── */
    #aptv-export-btn {
      background:none; border:none; color:#555; font-size:18px; cursor:pointer; padding:0 4px; line-height:1;
      transition:color 0.2s;
    }
    #aptv-export-btn:hover { color:#f0b429; }
    #aptv-export-menu {
      position:absolute; top:100%; right:0; background:#111; border:1px solid #333;
      border-radius:8px; padding:4px; z-index:100; min-width:160px;
      box-shadow:0 8px 32px rgba(0,0,0,0.5);
    }
    .aptv-export-opt {
      display:block; width:100%; text-align:left; padding:8px 12px; border:none;
      background:none; color:#ccc; font-size:11px; cursor:pointer; border-radius:4px;
      transition:background 0.2s;
    }
    .aptv-export-opt:hover { background:#1a1a1a; color:#f0b429; }

    #aptv-refresh {
      background:none; border:none; color:#555; font-size:20px; cursor:pointer; padding:0 4px; line-height:1;
      transition:color 0.2s, transform 0.3s;
    }
    #aptv-refresh:hover { color:#f0b429; transform:rotate(180deg); }
    #aptv-close {
      background:none; border:none; color:#666; font-size:24px; cursor:pointer; padding:0 4px; line-height:1;
    }
    #aptv-close:hover { color:#fff; }

    /* ── Tabs ── */
    #aptv-tabs {
      display:flex; border-bottom:1px solid #1a1a1a; background:#0a0a0a;
    }
    .aptv-tab {
      flex:1; padding:10px 0; text-align:center; font-size:9px; font-weight:700;
      letter-spacing:1px; color:#555; background:none; border:none;
      border-bottom:2px solid transparent; cursor:pointer; transition:all 0.2s;
    }
    .aptv-tab:hover { color:#999; }
    .aptv-tab.active { color:#f0b429; border-bottom-color:#f0b429; }

    /* ── Content ── */
    #aptv-content { flex:1; overflow-y:auto; padding:14px; }
    #aptv-content::-webkit-scrollbar { width:4px; }
    #aptv-content::-webkit-scrollbar-track { background:transparent; }
    #aptv-content::-webkit-scrollbar-thumb { background:#222; border-radius:4px; }

    /* ── Footer ── */
    #aptv-footer {
      display:flex; align-items:center; justify-content:center; gap:6px;
      padding:8px; font-size:9px; color:#444; border-top:1px solid #1a1a1a;
    }
    .aptv-footer-dot { color:#dc2626; }

    /* ── Empty / Loading / Error ── */
    #aptv-empty-state {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      padding:40px 20px; text-align:center; gap:10px;
    }
    #aptv-analyze-btn {
      padding:12px 32px; background:linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:800;
      letter-spacing:1px; cursor:pointer; transition:all 0.2s;
      box-shadow:0 4px 16px rgba(220,38,38,0.3);
    }
    #aptv-analyze-btn:hover { background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%); transform:translateY(-1px); }
    .aptv-tagline { font-size:10px; color:#555; font-style:italic; margin-top:4px; }
    .aptv-loading {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      padding:60px 20px; gap:12px;
    }
    .aptv-loading p { color:#888; font-size:13px; margin:0; }
    .aptv-progress-steps { display:flex; gap:4px; margin-top:12px; }
    .aptv-step {
      font-size:9px; padding:3px 8px; border-radius:4px; color:#444;
      background:#111; border:1px solid #1a1a1a; transition:all 0.3s;
    }
    .aptv-step.active { color:#f0b429; border-color:#f0b429; background:rgba(240,180,41,0.08); }
    .aptv-sub { font-size:11px !important; color:#555 !important; }
    .aptv-spinner {
      width:36px; height:36px; border:3px solid #1a1a1a; border-top-color:#f0b429;
      border-radius:50%; animation:aptv-spin 0.8s linear infinite;
    }
    @keyframes aptv-spin { to { transform:rotate(360deg); } }
    .aptv-error { display:flex; flex-direction:column; align-items:center; padding:40px 20px; gap:12px; }
    .aptv-error p { color:#dc2626; font-size:13px; }
    .aptv-btn-retry {
      padding:8px 20px; background:#dc2626; color:#fff; border:none; border-radius:6px;
      font-weight:700; cursor:pointer;
    }

    /* ── Sections ── */
    .aptv-section { margin-bottom:20px; }
    .aptv-section-title {
      font-size:10px; font-weight:700; letter-spacing:1.5px; color:#f0b429;
      margin:0 0 10px 0; text-transform:uppercase;
    }
    .aptv-empty { color:#555; font-size:13px; text-align:center; padding:30px 20px; }

    /* ── Gauges ── */
    .aptv-gauges-row { display:flex; justify-content:space-around; gap:4px; margin-bottom:12px; }
    .aptv-gauge { display:flex; flex-direction:column; align-items:center; }
    .aptv-gauge-label { font-size:9px; color:#888; text-align:center; margin-top:2px; font-weight:600; letter-spacing:0.5px; }

    /* ── Verdict Bar ── */
    .aptv-verdict-bar { display:flex; gap:4px; height:52px; border-radius:8px; overflow:hidden; }
    .aptv-verdict-segment {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      border-radius:6px; min-width:40px;
    }
    .aptv-verdict-segment span { font-size:18px; font-weight:800; color:#fff; }
    .aptv-verdict-segment small { font-size:9px; color:rgba(255,255,255,0.7); font-weight:600; }
    .aptv-bg-green { background:rgba(34,197,94,0.2); border:1px solid rgba(34,197,94,0.3); }
    .aptv-bg-red { background:rgba(220,38,38,0.2); border:1px solid rgba(220,38,38,0.3); }
    .aptv-bg-gold { background:rgba(240,180,41,0.2); border:1px solid rgba(240,180,41,0.3); }

    /* ── Density Bar ── */
    .aptv-density-bar { height:8px; background:#1a1a1a; border-radius:4px; overflow:hidden; margin-bottom:4px; }
    .aptv-density-fill { height:100%; background:linear-gradient(90deg, #dc2626 0%, #f0b429 50%, #22c55e 100%); border-radius:4px; transition:width 1s; }
    .aptv-density-label { font-size:10px; color:#666; }

    /* ── Summary ── */
    .aptv-summary-list { list-style:none; padding:0; margin:0; }
    .aptv-summary-list li {
      font-size:12px; color:#ccc; padding:8px 0 8px 12px;
      border-left:2px solid #dc2626; margin-bottom:6px; line-height:1.5;
    }

    /* ── Claims ── */
    .aptv-claim { padding:10px 12px; border-radius:8px; margin-bottom:8px; border:1px solid #1a1a1a; }
    .aptv-claim-verified { background:rgba(34,197,94,0.06); border-color:rgba(34,197,94,0.2); }
    .aptv-claim-false { background:rgba(220,38,38,0.06); border-color:rgba(220,38,38,0.2); }
    .aptv-claim-unverified { background:rgba(240,180,41,0.06); border-color:rgba(240,180,41,0.2); }
    .aptv-claim-opinion { background:rgba(100,100,100,0.06); }
    .aptv-claim-top { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
    .aptv-claim-text { font-size:12px; color:#ddd; flex:1; line-height:1.4; }
    .aptv-badge {
      font-size:8px; font-weight:800; letter-spacing:0.5px; padding:2px 6px;
      border-radius:4px; white-space:nowrap; border:1px solid;
    }
    .aptv-badge-verified { color:#22c55e; border-color:#22c55e; background:rgba(34,197,94,0.1); }
    .aptv-badge-false { color:#dc2626; border-color:#dc2626; background:rgba(220,38,38,0.1); }
    .aptv-badge-unverified { color:#f0b429; border-color:#f0b429; background:rgba(240,180,41,0.1); }
    .aptv-badge-opinion { color:#888; border-color:#444; }
    .aptv-claim-ts { font-size:10px; color:#555; font-family:monospace; display:block; margin-top:4px; }
    .aptv-seekable { cursor:pointer; transition:color 0.2s; }
    .aptv-seekable:hover { color:#f0b429; }

    /* ── Sentiment ── */
    .aptv-sentiment-bar { display:flex; height:28px; border-radius:6px; overflow:hidden; gap:2px; }
    .aptv-sent-seg { display:flex; align-items:center; justify-content:center; min-width:20px; border-radius:4px; }
    .aptv-sent-seg span { font-size:9px; font-weight:700; color:#fff; }
    .aptv-sent-pos { background:rgba(34,197,94,0.3); border:1px solid rgba(34,197,94,0.4); }
    .aptv-sent-neu { background:rgba(100,116,139,0.3); border:1px solid rgba(100,116,139,0.4); }
    .aptv-sent-mix { background:rgba(240,180,41,0.3); border:1px solid rgba(240,180,41,0.4); }
    .aptv-sent-neg { background:rgba(220,38,38,0.3); border:1px solid rgba(220,38,38,0.4); }
    .aptv-sent-legend { display:flex; gap:8px; align-items:center; margin-top:6px; font-size:9px; color:#666; }
    .aptv-sent-dot { width:8px; height:8px; border-radius:50%; display:inline-block; margin-left:6px; }
    .aptv-feedback-item { font-size:11px; color:#ccc; padding:4px 8px; margin-bottom:4px; border-radius:4px; line-height:1.4; }
    .aptv-fb-pos { background:rgba(34,197,94,0.06); border-left:2px solid #22c55e; }
    .aptv-fb-neg { background:rgba(220,38,38,0.06); border-left:2px solid #dc2626; }
    .aptv-script {
      font-size:11px; color:#ccc; line-height:1.6; white-space:pre-wrap;
      background:#0a0a0a; border:1px solid #1a1a1a; border-radius:8px;
      padding:12px; margin:0; font-family:"Inter",sans-serif; max-height:400px; overflow-y:auto;
    }

    /* ── Sources ── */
    .aptv-source-card {
      padding:10px; border-radius:8px; background:#0a0a0a;
      border:1px solid #1a1a1a; margin-bottom:6px; transition:border-color 0.2s;
    }
    .aptv-source-card:hover { border-color:#f0b429; }
    .aptv-source-header { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
    .aptv-match-pct { font-size:11px; font-weight:700; color:#f97316; white-space:nowrap; }
    .aptv-source-type { font-size:9px; color:#555; text-transform:uppercase; letter-spacing:0.5px; margin-top:4px; display:block; }

    /* ── Thumbnail Badges ── */
    .aptv-thumb-badge {
      position:absolute; top:6px; left:6px; width:24px; height:24px;
      border-radius:5px; display:flex; align-items:center; justify-content:center;
      font-weight:900; font-size:14px; font-family:"Inter",sans-serif;
      border:2px solid; background:rgba(0,0,0,0.85); z-index:10;
      pointer-events:none;
    }
    .aptv-claim-ev { font-size:11px; color:#888; margin:6px 0 0; line-height:1.4; }

    /* ── Stat Pills ── */
    .aptv-stat-pills { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
    .aptv-pill {
      font-size:10px; padding:4px 10px; border-radius:20px;
      background:#111; color:#999; border:1px solid #222;
    }
    .aptv-pill-danger { color:#dc2626; border-color:#dc2626; background:rgba(220,38,38,0.08); }

    /* ── Clusters ── */
    .aptv-cluster { padding:10px; border-radius:8px; background:rgba(220,38,38,0.04); border:1px solid rgba(220,38,38,0.15); margin-bottom:8px; }
    .aptv-cluster-head { display:flex; justify-content:space-between; font-size:10px; font-weight:700; color:#dc2626; margin-bottom:6px; }
    .aptv-cluster-tags { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px; }
    .aptv-tag-red { font-size:10px; background:rgba(220,38,38,0.1); color:#f87171; padding:2px 6px; border-radius:4px; }
    .aptv-cluster-why { font-size:11px; color:#888; margin:0; }

    /* ── Commenters ── */
    .aptv-commenter { padding:8px 10px; border-radius:6px; background:#0a0a0a; border:1px solid #1a1a1a; margin-bottom:4px; }
    .aptv-commenter-top { display:flex; justify-content:space-between; align-items:center; }
    .aptv-commenter-name { font-size:12px; color:#ddd; font-weight:500; }
    .aptv-commenter-flags { display:flex; gap:4px; margin-top:4px; flex-wrap:wrap; }
    .aptv-flag-gold { font-size:9px; font-weight:700; padding:1px 6px; border-radius:3px; background:rgba(240,180,41,0.1); color:#f0b429; }
    .aptv-flag-red { font-size:9px; font-weight:700; padding:1px 6px; border-radius:3px; background:rgba(220,38,38,0.1); color:#f87171; }

    /* ── Channel ── */
    .aptv-tier {
      display:inline-block; padding:5px 12px; border-radius:6px; font-size:11px;
      font-weight:700; margin-top:6px; border:1px solid; background:rgba(255,255,255,0.03);
    }
    .aptv-tier-reason { font-size:12px; color:#999; line-height:1.5; margin:12px 0; }

    /* ── Stats ── */
    .aptv-stats-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .aptv-stat-card {
      background:#0a0a0a; border:1px solid #1a1a1a; border-radius:8px;
      padding:12px; display:flex; flex-direction:column; gap:4px;
    }
    .aptv-stat-val { font-size:14px; font-weight:700; color:#fff; }
    .aptv-stat-lbl { font-size:9px; color:#666; text-transform:uppercase; letter-spacing:0.5px; }
    .aptv-tags { display:flex; flex-wrap:wrap; gap:4px; }
    .aptv-tag { font-size:10px; padding:3px 8px; border-radius:4px; background:#0a0a0a; color:#888; border:1px solid #1a1a1a; }
    .aptv-tag-gold { color:#f0b429; border-color:rgba(240,180,41,0.3); }

    /* ── Grade Inline Badge ── */
    .aptv-grade-inline {
      display:inline-flex; align-items:center; justify-content:center;
      width:28px; height:28px; border-radius:6px; font-weight:800; font-size:16px;
      margin-left:10px; cursor:pointer; border:2px solid; vertical-align:middle;
      font-family:"Inter",sans-serif; background:rgba(0,0,0,0.8);
    }
    .aptv-grade-a { color:#22c55e; border-color:#22c55e; }
    .aptv-grade-b { color:#3b82f6; border-color:#3b82f6; }
    .aptv-grade-c { color:#f0b429; border-color:#f0b429; }
    .aptv-grade-d { color:#f97316; border-color:#f97316; }
    .aptv-grade-f { color:#dc2626; border-color:#dc2626; }

    /* ── Creator Card ── */
    .aptv-creator-card {
      display:flex; align-items:center; gap:10px; padding:10px 12px;
      background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px;
      margin-bottom:16px;
    }
    .aptv-creator-avatar { width:40px; height:40px; border-radius:50%; border:2px solid #222; }
    .aptv-creator-info { display:flex; flex-direction:column; flex:1; min-width:0; }
    .aptv-creator-name { font-size:13px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .aptv-creator-subs { font-size:10px; color:#666; }
    .aptv-engagement { display:flex; flex-direction:column; gap:2px; align-items:flex-end; }
    .aptv-eng-item { display:flex; gap:4px; align-items:center; }
    .aptv-eng-label { font-size:8px; color:#555; text-transform:uppercase; }
    .aptv-eng-val { font-size:10px; color:#ccc; font-weight:600; }

    /* ── Red Flags ── */
    .aptv-red-flag {
      display:flex; gap:10px; padding:10px 12px; border-radius:8px;
      background:rgba(220,38,38,0.06); border:1px solid rgba(220,38,38,0.2);
      margin-bottom:8px;
    }
    .aptv-red-flag-icon { font-size:20px; color:#dc2626; line-height:1; flex-shrink:0; }
    .aptv-red-flag-body { flex:1; }
    .aptv-red-flag-claim { font-size:12px; color:#fca5a5; font-weight:600; margin:0 0 4px; line-height:1.4; }
    .aptv-red-flag-why { font-size:11px; color:#888; margin:0; line-height:1.4; }

    /* ── Share Button ── */
    .aptv-share-btn {
      padding:8px 24px; background:#111; color:#f0b429; border:1px solid #f0b429;
      border-radius:6px; font-size:11px; font-weight:700; letter-spacing:1px;
      cursor:pointer; transition:all 0.2s;
    }
    .aptv-share-btn:hover { background:#f0b429; color:#000; }

    /* ── Intel Tab ── */
    .aptv-link {
      display:block; font-size:11px; color:#3b82f6; text-decoration:none;
      margin:2px 0; word-break:break-all;
    }
    .aptv-link:hover { color:#60a5fa; text-decoration:underline; }
    .aptv-controversy {
      padding:10px; border-radius:8px; background:rgba(220,38,38,0.04);
      border:1px solid rgba(220,38,38,0.12); margin-bottom:6px;
    }
    .aptv-controversy-head { display:flex; gap:8px; align-items:center; }
    .aptv-trust-item {
      display:flex; align-items:flex-start; gap:6px; font-size:11px;
      padding:4px 0; line-height:1.4;
    }
    .aptv-trust-icon { font-size:12px; flex-shrink:0; margin-top:1px; }
    .aptv-trust-pos { color:#22c55e; }
    .aptv-trust-neg { color:#dc2626; }
    .aptv-social-link {
      display:flex; justify-content:space-between; align-items:center;
      padding:8px 10px; border-radius:6px; background:#0a0a0a;
      border:1px solid #1a1a1a; margin-bottom:4px; text-decoration:none;
      transition:border-color 0.2s;
    }
    .aptv-social-link:hover { border-color:#f0b429; }
    .aptv-social-platform { font-size:10px; font-weight:700; color:#f0b429; letter-spacing:1px; }
    .aptv-social-url { font-size:11px; color:#888; }

    /* ── SEO Analysis ── */
    .aptv-seo-grid { display:flex; flex-direction:column; gap:4px; }
    .aptv-seo-item {
      display:flex; align-items:center; justify-content:space-between;
      padding:6px 10px; background:#0a0a0a; border-radius:6px; border:1px solid #1a1a1a;
    }
    .aptv-seo-label { font-size:11px; color:#999; flex:1; }
    .aptv-seo-val { font-size:11px; color:#ccc; font-weight:600; margin:0 12px; }
    .aptv-seo-grade { font-size:9px; font-weight:700; padding:2px 8px; border-radius:4px; }
    .aptv-seo-good { color:#22c55e; background:rgba(34,197,94,0.1); }
    .aptv-seo-warn { color:#f0b429; background:rgba(240,180,41,0.1); }

    /* ── Niche Bar ── */
    .aptv-niche-bar {
      display:flex; justify-content:space-between; align-items:center;
      padding:8px 12px; background:#0a0a0a; border:1px solid #1a1a1a;
      border-radius:8px; margin-bottom:14px;
    }
    .aptv-niche-label {
      font-size:10px; font-weight:700; letter-spacing:1.5px; color:#f0b429;
      background:rgba(240,180,41,0.08); padding:3px 10px; border-radius:4px;
    }
    .aptv-niche-grade { font-size:11px; color:#888; }
    .aptv-niche-grade strong { font-size:14px; }
  `;
  document.head.appendChild(style);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
