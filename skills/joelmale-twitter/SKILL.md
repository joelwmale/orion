# joelmale-twitter

Post tweets to X (Twitter) via OAuth 1.0a API.

## Auth
- OAuth 1.0a credentials stored in `~/.clawdbot/credentials/joelmale-twitter-oauth1a.json`
- Credentials: consumer_key, consumer_secret, access_token, access_token_secret
- Never log or commit this file

## Post Tweet

```bash
bun tools/orion/twitter-post.ts post "Your tweet text here"
```

Response:
```json
{
  "id": "2010194818828513313",
  "url": "https://x.com/joelwmale/status/2010194818828513313"
}
```

## Usage

When Joel asks to post a tweet:
1. Write tweet text (280 chars max, can be multiple tweets if longer)
2. If multiple tweets needed, create them as separate tweets or thread them
3. Post via the twitter-post.ts tool
4. Return the tweet link: `https://x.com/joelwmale/status/{id}`

Examples:
- "Post a tweet about my latest blog post"
- "Tweet about a new Laravel feature"
- "Post this: [text]"

Best practices:
- Keep under 280 characters for single tweets
- For longer content, create multiple tweets (can thread manually or we create separately)
- Include relevant hashtags and @mentions
- Link to blog posts when promoting them
- Include personality and voice consistent with @joelwmale brand
