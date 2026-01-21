# Deep Research Data Sources

## Status Summary (2026-01-21)

| Source | Status | Access Method | Notes |
|--------|--------|---------------|-------|
| **Jina Reader** | ✅ WORKS | `elio_webscraping_jina_reader` | Some sites block (451/403) |
| **DuckDuckGo Search** | ✅ WORKS | `elio_webscraping_ddg_search` | Free, unlimited, generic queries |
| **Google News** | ✅ WORKS | `elio_webscraping_google_news` | RSS feed, funding news |
| **GitHub API** | ✅ WORKS | `elio_webscraping_ddg_search` | Search repos, code, profiles |
| **YouTube Transcripts** | ✅ WORKS | `elio_youtube_transcript` | Full transcripts, multi-language |
| **Perplexity** | ✅ WORKS | `elio_perplexity_search` | AI-powered search |
| **LinkedIn** | ⚠️ OWN PROFILE ONLY | Cookie-based | API blocked for other profiles |
| **G2/Capterra** | ⚠️ PARTIAL | Web search workaround | Direct blocked (CAPTCHA) |
| **Wellfound/AngelList** | ❌ BLOCKED | - | 403 Forbidden, CAPTCHA |
| **Twitter/X** | ⚠️ PARTIAL | Jina Reader | Profile metadata only, no tweets |
| **Spotify Podcasts** | ⚠️ PARTIAL | Jina Reader | Metadata only, no audio |
| **GDELT API** | ✅ WORKS | Direct fetch | News articles, funding detection |
| **RSS Feeds** | ✅ WORKS | Direct fetch | TechCrunch, Sifted, etc. |

---

## Working Sources (✅)

### 1. Jina Reader
**Tool**: `elio_webscraping_jina_reader`
**Use for**: Article content, company websites, press releases
**Limitations**:
- Some sites block with 451 (TechCrunch)
- Some return 403/CAPTCHA (G2, Wellfound)
**Tested working**:
- BusinessWire, PR Newswire
- Company websites (harvey.ai)
- Spotify metadata pages

### 2. DuckDuckGo Search
**Tool**: `elio_webscraping_ddg_search`
**Use for**: General web search, finding URLs
**Limitations**:
- `site:` operator often returns empty
- Common names return irrelevant results (movie "Harvey" vs Harvey AI)
**Best practices**:
- Use quoted phrases: `"Harvey AI" legal tech`
- Avoid site: filters, use general queries instead

### 3. Google News RSS
**Tool**: `elio_webscraping_google_news`
**Use for**: Recent news, funding announcements, PR
**Quality**: HIGH - returns relevant news articles with dates
**Example output**:
```json
{
  "title": "AI firm Harvey offers bumper pay deals to lure City lawyers",
  "url": "...",
  "published": "Mon, 12 Jan 2026",
  "source": "Financial News London"
}
```

### 4. YouTube Transcripts
**Tool**: `elio_youtube_transcript`
**Use for**: Podcast episodes, interviews, conference talks
**Quality**: HIGH - full transcripts with language options
**Features**:
- Auto-detect language
- Multiple language support
- Works on most videos with captions

### 5. GitHub (via search)
**Tool**: `elio_webscraping_ddg_search`
**Use for**: Company open source presence, tech stack analysis
**Query pattern**: `site:github.com {company}`

### 6. GDELT API
**Tool**: Direct fetch in funding-detection
**Use for**: Breaking news, funding announcements
**Lookback**: 72 hours default
**Output**: Article URLs (need Jina for body)

### 7. RSS Feeds
**Tool**: Direct fetch in funding-detection
**Configured feeds**:
- TechCrunch Startups
- VentureBeat
- Sifted (EU startups)
- EU-Startups
- PR Newswire Tech
- BusinessWire Tech
- Crunchbase News

---

## Partially Working (⚠️)

### 1. LinkedIn
**Status**: Cookie-based access works for authenticated user's profile only
**Cookie path**: `/root/.claude/secrets/linkedin-cookie.json`
**Working**:
- `/me` endpoint - own profile data
**Blocked**:
- Other profiles via Voyager API - returns 403 "This profile can't be accessed"
- Scrape.do proxy - returns 502
- Jina Reader - returns 999 (blocked)
- Playwright headless - redirected to authwall
**Why**: LinkedIn actively blocks all scraping. Even with valid session cookie, API restricts access to other users' profiles.
**Workarounds**:
- Use web search for LinkedIn profile snippets
- Check company websites for team info
- Use Google News for executive announcements

### 2. G2/Capterra Reviews
**Direct access**: BLOCKED (403, CAPTCHA)
**Workaround**: Use web search to get review summaries
```
Query: "{company} G2 reviews rating"
Query: "{company} Capterra reviews"
```
Returns snippets with ratings and review counts.

### 2. Twitter/X
**Tool**: `elio_webscraping_jina_reader`
**Access**: Profile metadata only (bio, followers count)
**Blocked**: Actual tweets require login
**Note**: Wrong handle @Harvey_AI is a musician, not the company

### 3. Spotify Podcasts
**Tool**: `elio_webscraping_jina_reader`
**Access**: Episode metadata, descriptions
**Blocked**: Actual audio content
**Workaround**: Find same episode on YouTube for transcript

---

## Not Working (❌)

### 3. Wellfound (AngelList)
**Tool**: Jina Reader
**Error**: 403 Forbidden
**Reason**: CAPTCHA protection

### 4. Job Boards (direct)
**Greenhouse**: 404 (company-specific boards moved)
**Lever**: 404 (same issue)
**Workaround**: Access company careers pages directly via Jina

---

## Source Mapping by Data Type

| Data Type | Primary Source | Fallback |
|-----------|---------------|----------|
| **Funding rounds** | Google News + GDELT | RSS feeds |
| **Company info** | Jina Reader (website) | Web search |
| **Team/headcount** | Company website, news | Web search |
| **Tech stack** | GitHub | Job postings |
| **Reviews** | Web search (G2 snippets) | News articles |
| **Interviews** | YouTube transcripts | - |
| **News/PR** | Google News | RSS feeds |
| **Job openings** | Company careers page | - |
| **Podcasts** | YouTube (same content) | Spotify metadata |

---

## Recommendations

### High Priority Fixes
1. ✅ **Perplexity** - Fixed! API key now properly configured
2. ⚠️ **LinkedIn** - Cookie works but API blocks other profiles (LinkedIn restriction, not fixable)

### Workarounds Documented
1. G2/Capterra → Use web search for review snippets
2. Job boards → Use company careers pages directly
3. Podcasts → Search YouTube for same episode
4. Twitter → Manual lookup or skip

### Best Practices
1. Always try Google News first for recent events
2. Use Jina Reader for article content (faster than search)
3. Use YouTube for any video/podcast content
4. Combine multiple sources for verification (≥2 sources rule)

---

## Testing Commands

```bash
# Test Jina Reader
elio_webscraping_jina_reader url="https://businesswire.com/..."

# Test Google News
elio_webscraping_google_news query="Harvey AI legal tech"

# Test YouTube
elio_youtube_transcript url="https://youtube.com/watch?v=..."

# Test DuckDuckGo
elio_webscraping_ddg_search query="\"Harvey AI\" funding 2025"
```

---

*Last updated: 2026-01-21*
