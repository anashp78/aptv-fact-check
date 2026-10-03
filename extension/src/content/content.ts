function extractVideoId(): string | null {
  const url = new URL(window.location.href);
  return url.searchParams.get("v");
}

function extractChannelInfo(): {
  channelId: string;
  channelName: string;
} | null {
  const channelLink = document.querySelector(
    "ytd-video-owner-renderer a.yt-simple-endpoint"
  );
  if (!channelLink) return null;

  const href = channelLink.getAttribute("href") ?? "";
  const channelId = href.replace(/^\/@/, "").replace(/^\/channel\//, "");
  const channelName = channelLink.textContent?.trim() ?? "";

  return { channelId, channelName };
}

function extractTitle(): string {
  const titleEl = document.querySelector(
    "yt-formatted-string.ytd-watch-metadata"
  );
  return titleEl?.textContent?.trim() ?? document.title;
}

function notifyVideoDetected(): void {
  const videoId = extractVideoId();
  if (!videoId) return;

  const channel = extractChannelInfo();
  const title = extractTitle();

  chrome.runtime.sendMessage({
    type: "VIDEO_DETECTED",
    videoId,
    channelId: channel?.channelId ?? "",
    channelName: channel?.channelName ?? "",
    title,
  });
}

let lastVideoId: string | null = null;

function checkForVideoChange(): void {
  const currentId = extractVideoId();
  if (currentId && currentId !== lastVideoId) {
    lastVideoId = currentId;
    setTimeout(notifyVideoDetected, 1500);
  }
}

const observer = new MutationObserver(() => {
  checkForVideoChange();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

checkForVideoChange();
