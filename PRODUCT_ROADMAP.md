# APTV Fact Check — Product Roadmap

## Vision
**Short-term:** The credibility layer of YouTube. Not analytics, not optimization — TRUTH.
**Long-term:** A universal AI analysis platform (Lenses) that works across any website, any content, any use case. APTV Fact Check is the flagship lens.

---

## MVP SCOPE (Launch This First)

Everything below this line is what ships for v1.0. No more features until this is live, tested, and generating revenue.

### What's Built (DONE)
- Chrome extension with VidIQ-style overlay (6 tabs, black/red/gold APTV branding)
- AI pipeline: claim extraction → fact checking → niche-relative scoring → comments → intel → sources
- 89 verified facts across 5 niches (craps, blackjack, sports betting, finance, health)
- Channel intelligence via Tavily web search
- Sock puppet detection via YouTube Data API
- Response script generator (single format)
- Thumbnail grade badges, timestamp navigator, keyboard shortcut
- Deterministic grading formula (composite score, not AI opinion)
- Loading progress indicator, APTV logo icons
- Rate limiting, timeouts, error resilience, XSS protection
- Dockerfile + CI/CD for Azure
- Privacy policy + Chrome Web Store listing copy

### What's Left to Ship MVP (do these, then launch)

| # | Task | What | Status |
|---|------|------|--------|
| 1 | Fix auth for production | Better-Auth with proper Kysely adapter + DB migrations | Not started |
| 2 | Stripe integration | Create products, wire checkout, webhook for tier changes | Not started |
| 3 | Deploy API to Azure | Container App + PostgreSQL Flexible Server + Key Vault | Not started |
| 4 | Chrome Web Store submission | Screenshots, listing, privacy policy URL, review process | Not started |
| 5 | ElevenLabs integration | Connect API for voice generation on response scripts | Not started |
| 6 | Test + fix grading on 20 real channels | Calibration pass to validate grades match editorial judgment | Not started |

**That's it. Six tasks. Ship it.**

---

## POST-LAUNCH PHASES (build after MVP is live and generating revenue)

### Phase 1: Viewer Growth (drive installs)
| Feature | Description |
|---------|-------------|
| Shared grade cache | Grade badges on ALL thumbnails from cross-user cache |
| Trust alerts | Warning bar when landing on D/F channel |
| Alternative recommendations | "Videos like this but better" — A-rated alternatives |
| User preferences | Favorite niches, alert thresholds, display settings |
| Community voting | "Was this grade accurate?" crowdsourced calibration |

### Phase 2: Creator Tools (drive Plus subscriptions)
| Feature | Description |
|---------|-------------|
| Creator Dashboard | Channel grade history, trends, improvement suggestions |
| Competitor tracker | Monitor 5 rivals, alerts on new uploads |
| Pre-publish fact-checker | Paste script, get claims checked before recording |
| Channel comparison UI | Side-by-side visual in the overlay |

### Phase 3: Response Studio (drive Pro subscriptions)
| Feature | Description |
|---------|-------------|
| Multi-format script generator | 6 formats: Roast, Debunk, Short, Documentary, Thread, Blog |
| Intercut script with timestamps | "[PLAY CLIP 2:34-2:48] → narration" format |
| Voice cloning | Upload 3 min of audio, narrate in your voice |
| Legal guardrail checker | Flag defamation risk, suggest safe alternatives |
| Multi-video investigation | Analyze 50 videos from one channel, compile evidence |
| Video assembly pipeline | ffmpeg auto-assembly: clips + narration + overlays |
| Thumbnail generator | AI thumbnail with subject's face + grade |

### Phase 4: Community Layer (network effects)
| Feature | Description |
|---------|-------------|
| Community Notes for YouTube | Fact-check overlays visible to all APTV users |
| Creator verification program | A-rated channels earn verified badge |
| Response chain linking | Link response video to original |
| Misinformation dashboard | Trending videos with most false claims |

### Phase 5: Enterprise (drive Team/Enterprise revenue)
| Feature | Description |
|---------|-------------|
| Brand safety scoring | Profanity, controversy, political content rating |
| Bulk channel screening | Paste 50 URLs, get reports on all |
| White-label PDF exports | Client-branded reports |
| Public API | Third-party integration, per-call pricing |
| Audience authenticity | Bot follower / fake engagement detection |

---

## PLATFORM VISION (after APTV is profitable)

### The Universal Analysis Platform: Lenses

APTV Fact Check is one **lens** on a universal platform. The core engine works on any content:

```
Universal Extension
  ├── Content Extractor (per-site: YouTube, TikTok, Twitter, any webpage)
  ├── AI Analysis Engine (configurable prompts per lens)
  ├── Knowledge Base (per-lens verified facts)
  ├── Overlay Renderer (per-site injection)
  └── Lenses (user-selected analysis modes)
       ├── APTV Fact Check ← flagship, already built
       ├── Study Engine ← WGU course analysis
       ├── Job Search Lens ← posting analysis, company intel
       ├── Research Lens ← source verification, bias detection
       ├── Shopping Lens ← review authenticity, claim verification
       ├── News Lens ← bias detection, source checking
       ├── Sports Lens ← tipster verification, pick accuracy
       ├── Sales Page Detector ← BS scoring on landing pages
       └── Custom Lens ← user defines own prompts/criteria
```

### Each Lens is a Configuration
```
Lens = {
  name, sites[], extractor, prompts{}, knowledgeBase, ui{tabs, gauges, branding}
}
```

### Existing Products That Become Lenses
| Product | Lens | Status |
|---------|------|--------|
| APTV Fact Check | YouTube Credibility | Built |
| WGU Study Engine | Education | Engine exists, needs web extractor |
| Job Search Pipeline | Job Analysis | Smart-apply scoring → lens |
| Max EV Sports | Sports Betting | Tipster verification |
| DFW Daily | News Analysis | Bias detection |

### Platform Revenue Model
| Stream | Model |
|--------|-------|
| Free | 1 default lens, 3 analyses/day |
| Plus $9.99 | Unlimited, 3 active lenses |
| Pro $24.99 | Unlimited lenses, custom builder, Response Studio |
| Lens Marketplace | Community lenses, revenue share |
| Knowledge Base Subscriptions | Premium fact libraries, $4.99/mo per niche |
| Enterprise | Custom deployment, API, bulk licenses |

### Platform Brand
APTV stays as the YouTube credibility vertical. The platform umbrella needs its own name (TBD — Max EV Lens, TruthLens, Clarity, etc).

**DO NOT BUILD THE PLATFORM UNTIL APTV IS PROFITABLE.** The platform is the 12-month vision. APTV MVP is the next-2-weeks reality.

---

## Pricing (MVP Launch)

| Tier | Price | Limit | Features |
|------|-------|-------|----------|
| Free | $0 | 3/day | Grade + claims only, no Intel/Comments |
| Plus | $9.99/mo | 20/day | Full analysis, Intel, Comments, Sources |
| Pro | $24.99/mo | 50/day | Response scripts, ElevenLabs, API access |
| Team | $49.99/mo | 200/day | 5 seats, bulk screening, white-label |

---

## Key Metrics
- Chrome Web Store installs
- Daily active users
- Videos analyzed per day
- Free → Plus conversion rate
- Shared cache hit rate
- Response scripts generated
- Revenue / MRR
