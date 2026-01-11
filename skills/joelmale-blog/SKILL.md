# joelmale-blog

Publish blog posts to joelmale.com via API.

## Auth
- Bearer token stored in `~/.clawdbot/credentials/joelmale-blog-token.txt`
- Never log or commit this token

## Create Post

curl -X POST https://joelmale.com/api/blog/posts \
-H "Authorization: Bearer $(cat ~/.clawdbot/credentials/joelmale-blog-token.txt)" \
-H "Content-Type: application/json" \
-d '{
"slug": "post-title",
"title": "Post Title",
"description": "Summary",
"seo_title": "SEO Title",
"seo_description": "SEO Description",
"content": "# Content here",
"status": "draft",
"tags": "tag1", "tag2"
"category_ids": [category-id-1, category-id-2]
}'

## Update Post

curl -X PUT https://joelmale.com/api/blog/posts/1 \
-H "Authorization: Bearer $(cat ~/.clawdbot/credentials/joelmale-blog-token.txt)" \
-H "Content-Type: application/json" \
-d '{
"title": "Updated Post Title",
"description": "Updated Summary",
"seo_title": "Updated SEO Title",
"seo_description": "Updated SEO Description",
"content": "# Updated Content here",
"status": "draft",
"tags": "tag1", "tag2"
"category_ids": [category-id-1, category-id-2]
}'

## List Posts

curl -X GET https://joelmale.com/api/blog/posts \
-H "Authorization: Bearer $(cat ~/.clawdbot/credentials/joelmale-blog-token.txt)" \
-H "Content-Type: application/json"

## Get Post

curl -X GET https://joelmale.com/api/blog/posts/1 \
-H "Authorization: Bearer $(cat ~/.clawdbot/credentials/joelmale-blog-token.txt)" \
-H "Content-Type: application/json"

## Get Categories

curl -X GET https://joelmale.com/api/blog/categories \
-H "Authorization: Bearer $(cat ~/.clawdbot/credentials/joelmale-blog-token.txt)" \
-H "Content-Type: application/json"

## Usage

When Joel asks to publish a blog post:
1. Draft content in markdown
2. Generate slug from title (lowercase, hyphens)
3. Get category IDs from API
4. Create as draft via API
5. Send the admin URL to Joel for review/publish
