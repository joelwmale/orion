# joelmale-blog-analytics

Get analytics for specific blog posts from Pirsch.

## Auth
- Pirsch OAuth credentials stored in `~/.clawdbot/credentials/pirsch-analytics.json`
- Website ID: `zy1bBvG1lv`

## Get Blog Post Analytics

```bash
bun tools/orion/blog-analytics.ts "<post-title>" [days]
bun tools/orion/blog-analytics.ts <slug> [days]
```

Response:
```json
{
  "slug": "use-bun-as-your-package-manager-in-any-laravel-project",
  "path": "/blog/use-bun-as-your-package-manager-in-any-laravel-project",
  "period": "2025-12-28 to 2026-01-11",
  "visitors": 10,
  "views": 12,
  "sessions": null,
  "bounce_rate": null,
  "growth": {
    "visitors": 0.6666666666666666,
    "views": 0.7142857142857143
  }
}
```

## Usage

When Joel asks for blog post analytics:
1. Accept either full title or pre-made slug
2. Auto-slugify titles if needed (lowercase, hyphens)
3. Fetch data for specified period (default 14 days)
4. Report visitors, views, and growth rates
5. Optionally correlate with social media posts (Twitter/LinkedIn)

Examples:
- "How many views for my Bun post?"
- "Get analytics for 'Use Bun as your package manager in any Laravel project' last 7 days"
- "Show me stats for my latest blog post"
- "Which of my blog posts got the most traffic this month?"

Can also integrate with content calendar:
- Track performance of newly published posts
- Identify trending posts to promote on Twitter/LinkedIn
- Monitor bounce rates and time on page
