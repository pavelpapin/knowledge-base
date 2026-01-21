# Data Sources for DeepResearch Agent

## Current Integrations (MCP)

| Source | Tool | Use Case | Status |
|--------|------|----------|--------|
| Perplexity | `elio_perplexity_search` | AI-powered search | ✅ Active |
| LinkedIn | `elio_linkedin_profile/search` | People, companies | ✅ Active |
| YouTube | `elio_youtube_transcript` | Video transcripts | ✅ Active (Supadata) |
| Notion | `elio_notion_*` | Storage, reports | ✅ Active |

---

## YouTube Strategy (Token-Efficient)

### Overview

YouTube is a valuable but token-expensive source. We use a **smart selection strategy** to maximize value while minimizing token usage.

### Selection Pipeline

```
Search (web) → Score → Filter → Transcript (top 3-5) → Extract Insights
```

### Scoring Criteria

| Factor | Weight | Scoring |
|--------|--------|---------|
| Channel authority | 30% | TED/Google/YC = +3, Verified = +0.5, >1M subs = +1.5 |
| Engagement | 25% | >1M views = +1.5, >100K = +1.0 |
| Content type | 20% | Conference/keynote = 1.0, Interview = 0.9, Tutorial = 0.85 |
| Recency | 15% | <30 days = +1.5, <180 days = +1.0 |
| Duration | 10% | 10-60 min = +1.0, <5 min or >2h = -1.0 |

### Skip Rules (Auto-Filter)

- Reaction videos
- Videos < 5 minutes
- Videos > 2 hours
- Old (>1 year) + low views (<1000)
- Channels < 10K subscribers (unless verified expert)
- Clickbait patterns in title

### Token Budget

```
Per research topic:
├── Max videos: 3-5 (based on depth)
├── Max tokens per video: ~10,000
├── Total YouTube budget: 50,000 tokens
└── Extract: insights only (not full transcript)
```

### Preferred Sources

**Tech/AI Topics:**
- TED Talks
- Google I/O, AWS re:Invent
- Y Combinator, Sequoia Capital
- Lex Fridman, Fireship, ThePrimeagen

**Business Topics:**
- Stanford GSB, Harvard Business Review
- Tim Ferriss, Gary Vaynerchuk

### API Details

**Primary:** Supadata API (`elio_youtube_transcript`)
- Works from cloud IPs
- 60s timeout
- Returns full transcript

**Fallback:** youtube-transcript-api (Python)
- May be blocked on cloud IPs
- Used only if Supadata fails

### Integration Code

```typescript
// In retrieval.ts
import { processYoutubeVideos } from './youtube';

// After web search finds video URLs:
const sources = await processYoutubeVideos(
  videoList,
  topic,
  maxVideos  // 3-5 based on depth
);
```

### When to Use YouTube

| Topic Type | Priority | Reason |
|------------|----------|--------|
| AI/ML | HIGH | Conference talks, demos |
| Startups | MEDIUM | Founder interviews |
| How-to | HIGH | Visual demonstrations |
| Finance | LOW | Better text sources |
| News | LOW | Outdates quickly |

---

## FREE Data Sources (Priority)

### 1. Web Search

#### Brave Search API ⭐ RECOMMENDED
- **URL**: https://brave.com/search/api/
- **Free tier**: 2,000 searches/month (ongoing!)
- **Paid**: $5 per 1,000 searches
- **Features**: Web, News, Images, independent index
- **Why**: Privacy-focused, no Google dependency

```bash
# Add to systemd
Environment=BRAVE_API_KEY=xxx
```

#### DuckDuckGo (via scraping)
- **URL**: https://github.com/luminati-io/duckduckgo-api
- **Free**: Unlimited (scraping)
- **Caveat**: No official API, use duckduckgo-search Python library
- **Best for**: Backup search

```python
from duckduckgo_search import DDGS
results = DDGS().text("query", max_results=10)
```

#### SearXNG (self-hosted)
- **URL**: https://docs.searxng.org/
- **Free**: Unlimited (self-hosted metasearch)
- **Cost**: Only VPS ($5-20/month)
- **Features**: Aggregates Google, Bing, DuckDuckGo, etc.
- **Best for**: High volume (100K+ searches/month)

### 2. Web Scraping / Content Extraction

#### Jina Reader ⭐ RECOMMENDED
- **URL**: https://r.jina.ai/
- **Free tier**: 1,000,000 tokens/month!
- **Usage**: Just prepend `https://r.jina.ai/` to any URL
- **Output**: Clean markdown, perfect for LLMs

```bash
# No API key needed!
curl "https://r.jina.ai/https://example.com"
```

#### Crawl4AI (self-hosted) ⭐ BEST OPEN SOURCE
- **URL**: https://github.com/unclecode/crawl4ai
- **Free**: Unlimited (self-hosted)
- **Stars**: 58,000+ on GitHub
- **Features**:
  - LLM-ready markdown output
  - JavaScript rendering
  - Runs completely offline
  - No external API calls

```bash
pip install crawl4ai
```

```python
from crawl4ai import WebCrawler
crawler = WebCrawler()
result = crawler.run("https://example.com")
print(result.markdown)
```

#### Firecrawl (open-source version)
- **URL**: https://github.com/mendableai/firecrawl
- **Free**: Self-hosted via Docker
- **Paid API**: From $20/month

### 3. LinkedIn Data

> ⚠️ **Warning**: Proxycurl shut down July 2026 after LinkedIn lawsuit

#### Option A: RapidAPI LinkedIn Scrapers
- **URL**: https://rapidapi.com/search/linkedin
- **Free tier**: Usually 100-500 requests
- **Examples**:
  - Fresh LinkedIn Scraper
  - LinkedIn Profile Data API

#### Option B: Bright Data
- **URL**: https://brightdata.com/products/datasets/linkedin
- **Free trial**: Available
- **Features**: Legal, GDPR compliant

#### Option C: PhantomBuster
- **URL**: https://phantombuster.com/
- **Free tier**: 14-day trial
- **Features**: No-code LinkedIn extraction

#### Option D: Self-hosted scraping (risky)
- Use Playwright + proxies
- Risk: LinkedIn blocks aggressively
- Only for public profiles

### 4. News & Current Events

#### Brave News API
- Included in Brave Search API
- Endpoint: `/news`

#### Google News RSS (free)
- **URL**: `https://news.google.com/rss/search?q=query`
- **Free**: Unlimited
- **Format**: RSS/XML

```python
import feedparser
feed = feedparser.parse("https://news.google.com/rss/search?q=AI+startups")
for entry in feed.entries:
    print(entry.title, entry.link)
```

### 5. Academic / Research

#### Semantic Scholar API ⭐ FREE
- **URL**: https://api.semanticscholar.org/
- **Free tier**: 100 requests/5 minutes
- **Features**: Papers, citations, authors

#### arXiv API (free)
- **URL**: https://arxiv.org/help/api
- **Free**: Unlimited
- **Best for**: AI/ML, Physics, Math papers

#### OpenAlex (free)
- **URL**: https://openalex.org/
- **Free**: Unlimited, open dataset
- **Features**: 250M+ works, citations, institutions

---

## ❌ NOT Available / Too Expensive

| API | Status | Reason |
|-----|--------|--------|
| Bing Search API | ❌ Retired Aug 2025 | Microsoft killed it |
| Grounding with Bing | ❌ $35/1000 | Too expensive |
| Tavily | ❌ $50/month | Over budget |
| Serper | ❌ $50 | One-time, but unnecessary |
| Google Custom Search | ❌ $5/1000 | Limited, expensive |

---

## Recommended FREE Stack

```
Search:
├── Brave Search API (2K/month free) - primary
├── DuckDuckGo (scraping) - backup
└── Google News RSS - news

Content Extraction:
├── Jina Reader (1M tokens free) - simple pages
└── Crawl4AI (self-hosted) - complex/JS pages

Academic:
├── Semantic Scholar - papers
├── arXiv - preprints
└── OpenAlex - metadata

People:
├── LinkedIn (existing MCP) - profiles
├── RapidAPI free tier - backup
└── Manual research - fallback
```

## API Keys to Add

```ini
# /etc/systemd/system/elio-bot.service

# Already configured
Environment=GROQ_API_KEY=xxx
Environment=OPENAI_API_KEY=xxx
Environment=PERPLEXITY_API_KEY=xxx

# Add these (free tiers)
Environment=BRAVE_API_KEY=xxx          # Get at: https://api-dashboard.search.brave.com/
Environment=SEMANTIC_SCHOLAR_KEY=xxx   # Optional, higher limits
```

## Integration Priority

### Phase 1: Immediate (Free)
1. ✅ Perplexity (already have)
2. 🔲 Brave Search API (sign up, free 2K/month)
3. 🔲 Jina Reader (no signup needed)
4. 🔲 Google News RSS (no signup needed)

### Phase 2: Self-hosted
1. 🔲 Crawl4AI (pip install)
2. 🔲 DuckDuckGo search library

### Phase 3: If needed
1. 🔲 SearXNG (if volume > 2K/month)
2. 🔲 Semantic Scholar (for academic research)

---

## Agent-to-Source Mapping (Updated)

| Agent | Primary | Backup | Free? |
|-------|---------|--------|-------|
| Web Scout | Brave, Jina Reader | DuckDuckGo | ✅ |
| Market Analyst | Perplexity, Brave News | Google News RSS | ✅ |
| Tech Analyst | Perplexity, arXiv | Semantic Scholar | ✅ |
| Legal Analyst | Perplexity | Brave Search | ✅ |
| People Analyst | LinkedIn MCP, RapidAPI | Manual | ⚠️ Limited |

---

## Monthly Cost Estimate

| Service | Cost |
|---------|------|
| Brave Search (2K free) | $0 |
| Jina Reader (1M tokens) | $0 |
| Crawl4AI (self-hosted) | $0 |
| Perplexity (existing) | $0* |
| Google News RSS | $0 |
| **Total** | **$0** |

*Perplexity has usage-based pricing but generous free tier

## Sources

- [Brave Search API](https://api-dashboard.search.brave.com/app/documentation)
- [Jina Reader](https://r.jina.ai/)
- [Crawl4AI](https://github.com/unclecode/crawl4ai)
- [Semantic Scholar API](https://api.semanticscholar.org/)
- [7 Free Web Search APIs](https://www.kdnuggets.com/7-free-web-search-apis-for-ai-agents)
- [Best Open-Source Web Crawlers](https://www.firecrawl.dev/blog/best-open-source-web-crawler)
