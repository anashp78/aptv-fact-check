# APTV Fact Check — YouTube Credibility Extension

Chrome extension that analyzes YouTube videos in real-time. Extracts claims from transcripts, fact-checks them against verified knowledge bases, detects sock puppet commenters, and scores channel credibility — all displayed in a VidIQ-style sidebar overlay.

**Live API:** Deployed on Azure Container Apps

---

## Architecture

```
YouTube Video Page
    |
    v
Chrome Extension (MV3, TypeScript, React)
    → Detects video, extracts transcript
    → Sends to APTV API
    |
    v
APTV API (Bun + Hono)
    → DeepSeek: Claim extraction from transcript
    → DeepSeek: Fact check against knowledge bases
    → DeepSeek: Scoring + grade calculation
    → Tavily: Channel intel via web search
    → YouTube Data API: Comment analysis
    |
    v
6-Tab Sidebar Overlay
    → Overview (letter grade, meters, AI summary)
    → Claims (timestamps, verdicts, navigator)
    → Comments (sock puppet detection, credibility scores)
    → Intel (channel owner, controversies, trust indicators)
    → Sources (originality check via web search)
    → Stats (historical grades, trends)
```

## Features

- **Deterministic grading** — composite formula: accuracy 30%, integrity 25%, value 25%, originality 10%, title accuracy 10%
- **89 verified facts** across 5 knowledge bases (craps, blackjack, sports betting, finance, health)
- **Sock puppet detection** — writing style fingerprinting across 10 dimensions (vocabulary, punctuation, misspellings, emoji patterns)
- **Channel intelligence** — Tavily web search for owner info, controversies, revenue estimates
- **Source detection** — checks if content is copied from other creators
- **Timestamp navigator** — click any claim to seek video to that moment
- **Grade badges** — letter grades injected onto video thumbnails in search results
- **Response script generator** — AI-written rebuttal scripts from false claims

## Stack

- **Extension:** Chrome Manifest V3, TypeScript, React, Vite
- **API:** Bun + Hono + Drizzle + PostgreSQL
- **AI:** DeepSeek V3 (~$0.06/video), Tavily web search
- **Auth:** Better-Auth with Drizzle adapter
- **Payments:** Stripe (tier gating: Free 3/day, Plus 20/day, Pro 50/day)
- **Deploy:** Azure Container Apps + ACR + PostgreSQL Flexible Server
- **CI/CD:** GitHub Actions → ACR build → Container App update

## Cost Model

| Component | Cost/Video |
|-----------|-----------|
| DeepSeek (5 calls) | ~$0.015 |
| Tavily (4 searches) | ~$0.04 |
| YouTube Data API | Free tier |
| **Total** | **~$0.055** |

## Author

**Will Peterson** — Solutions Architect & Forward Deployed Engineer at Wolters Kluwer.
