# joelmale-analytics

Fetch analytics from Pirsch for your websites.

## Auth
- Credentials stored in `~/.clawdbot/credentials/pirsch-analytics.json`
- Contains: access_key, secret, domain
- Never log or commit this file

## Fetch Analytics

```bash
bun tools/orion/pirsch-analytics.ts <domain> [days]
```

Examples:
```bash
bun tools/orion/pirsch-analytics.ts joelmale.com 7    # Last 7 days
bun tools/orion/pirsch-analytics.ts joelmale.com 30   # Last 30 days
bun tools/orion/pirsch-analytics.ts joelmale.com 1    # Yesterday
```

Response:
```json
{
  "domain": "joelmale.com",
  "period": "2026-01-04 to 2026-01-11",
  "visitors": 1250,
  "sessions": 1450,
  "pageviews": 3200,
  "bounce_rate": 45.3,
  "avg_session_duration": 245,
  "top_pages": [
    {
      "page": "/blog/my-post",
      "views": 450,
      "visitors": 380
    }
  ],
  "top_referrers": [
    {
      "referrer": "twitter.com",
      "visitors": 120
    }
  ]
}
```

## Usage

When Joel asks for analytics:
1. Fetch data for the specified domain and period
2. Summarize traffic, top pages, referrers
3. Compare to previous period if requested
4. Highlight trends

Examples:
- "Show me analytics for joelmale.com last 7 days"
- "How did my blog perform this month?"
- "What pages are getting the most traffic?"
- "Where are my visitors coming from?"

Integration points:
- Daily summary can include blog traffic stats
- Blog post publishing can auto-fetch performance after a few days
- Trending posts can be shared on Twitter/LinkedIn
