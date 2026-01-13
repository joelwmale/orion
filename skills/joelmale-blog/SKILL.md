# joelmale-blog

Publish and update blog posts to joelmale.com via API.

## Auth
- Bearer token stored in `~/.clawdbot/credentials/joelmale-blog-token.txt`
- Never log or commit this token
- Token: `Authorization: Bearer <token>`

## Available Categories
**Always choose from this list.** Fetch from API if unsure.

| ID | Name | Slug |
|---|---|---|
| 1 | Dev | dev |
| 2 | Careers | careers |
| 3 | Thoughts | thoughts |
| 4 | Announcements | announcements |
| 5 | eCommerce | ecommerce |

## API Endpoints

### Get Categories
```bash
curl -X GET https://joelmale.com/api/blog/categories \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

### List Posts
```bash
curl -X GET https://joelmale.com/api/blog/posts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

### Get Single Post
```bash
curl -X GET https://joelmale.com/api/blog/posts/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

### Create Post (Draft)
```bash
curl -X POST https://joelmale.com/api/blog/posts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "post-slug-here",
    "title": "Post Title",
    "excerpt": "Summary for listings",
    "seo_title": "SEO Title (70 chars)",
    "seo_description": "SEO description (160 chars)",
    "content": "# Markdown content here",
    "status": "draft",
    "tags": ["tag1", "tag2", "tag3"],
    "category_ids": [1]
  }'
```

### Update Post
```bash
curl -X PUT https://joelmale.com/api/blog/posts/{id} \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "excerpt": "Updated excerpt",
    "seo_title": "Updated SEO Title",
    "seo_description": "Updated SEO description",
    "content": "# Updated content",
    "status": "draft",
    "tags": ["tag1", "tag2"],
    "category_ids": [1]
  }'
```

## Tagging Guidelines

**Always add tags.** They're for searchability. Examples:
- Technical posts: `["laravel", "devops", "testing", "deployment"]`
- Business posts: `["saas", "startups", "pricing", "metrics"]`
- Updates: `["announcements", "release-notes"]`

## Workflow

When Joel asks to create/update a blog post:
1. **Confirm category** — Ask if unsure, or infer from content
2. **Generate tags** — Read content, extract 4-8 relevant terms
3. **Create/update via API** — Always use draft status initially
4. **Send admin URL** — Joel reviews at `/dash/admin/posts/{id}/edit` before publishing

**Example tags by content:**
- Laravel posts → laravel, composer, php, deployment, testing
- Case studies → client work, case-study, pixel, results
- DevOps → devops, linux, docker, automation, infrastructure
