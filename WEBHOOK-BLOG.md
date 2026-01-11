# Blog Publish Webhook Setup

## Overview

When you publish a blog post, POST to this webhook and Orion will:
1. Read your blog post (fetch the URL)
2. Extract title and excerpt
3. Generate a tweet in your voice
4. (Soon) Auto-post to Twitter

## Webhook Details

**Secret Token:** `rsx09iwe0vlna3eji40r`

**Endpoint:** (TBD - once you have static IP)
```
POST http://your-clawdbot-ip:PORT/webhook/blog-publish
```

**Required Header:**
```
X-Blog-Webhook-Token: rsx09iwe0vlna3eji40r
```

**Payload:**
```json
{
  "url": "https://joelmale.com/blog/your-post-slug",
  "status": "published"
}
```

## Laravel Implementation

In your blog's post publishing code, add:

```php
// When publishing a post
$postUrl = route('blog.show', $post->slug);

Http::withHeaders([
    'X-Blog-Webhook-Token' => env('WEBHOOK_BLOG_TOKEN'),
])->post(env('WEBHOOK_BLOG_URL'), [
    'url' => $postUrl,
    'status' => 'published',
]);
```

Add to `.env`:
```
WEBHOOK_BLOG_TOKEN=rsx09iwe0vlna3eji40r
WEBHOOK_BLOG_URL=http://your-clawdbot-ip:PORT/webhook/blog-publish
```

## Response

Success (200):
```json
{
  "success": true,
  "post": {
    "title": "Your Post Title",
    "excerpt": "First 300 chars of content...",
    "url": "https://joelmale.com/blog/your-post"
  },
  "tweet": "Generated tweet in Joel's voice",
  "message": "Blog post webhook received. Tweet generated (not posted yet—manual review needed)."
}
```

Error (401 - Bad Token):
```json
{
  "error": "Unauthorized"
}
```

Error (400 - Bad Payload):
```json
{
  "error": "Invalid payload. Need: { url, status: 'published' }"
}
```

## Implementation Path

1. You set up static IP and give me clawdbot URL + port
2. I integrate this webhook into clawdbot server
3. You add the webhook call to your blog's publish logic
4. Test with a draft post
5. (Optional) Auto-post tweets instead of just generating them

## Tweet Generation Rules

Current: Simple templates (can improve based on post content)
- "New post: \"${title}\""
- "Just wrote about: ${title}. Check it out."
- "${title}. Worth a read."

Future: Parse post content, generate contextual tweets in Joel's voice
