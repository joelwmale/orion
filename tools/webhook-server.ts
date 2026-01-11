import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Load secret token
function getSecretToken(): string {
  const tokenPath = join(homedir(), ".clawdbot", "credentials", "blog-webhook-token.txt");
  
  if (!existsSync(tokenPath)) {
    throw new Error(`Token not found at ${tokenPath}`);
  }
  
  return readFileSync(tokenPath, "utf8").trim();
}

// Fetch and parse blog post
async function fetchBlogPost(url: string): Promise<{ title: string; excerpt: string; url: string }> {
  const res = await fetch(url);
  
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  
  const html = await res.text();
  
  // Extract title
  const titleMatch = html.match(/<h1[^>]*>[\s\n]*([^<]+)/);
  const title = titleMatch ? titleMatch[1].trim() : "New Blog Post";
  
  // Extract excerpt or first 200 chars of content
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
  let excerpt = "";
  
  if (articleMatch) {
    let content = articleMatch[1];
    content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/g, "");
    content = content.replace(/<[^>]*>/g, " ");
    content = content.replace(/\s+/g, " ").trim();
    excerpt = content.substring(0, 300);
  }
  
  return { title, excerpt, url };
}

// Generate tweet in Joel's voice
function generateTweet(title: string, url: string): string {
  const templates = [
    `New post: "${title}"`,
    `Just wrote about: ${title}. Check it out.`,
    `${title}. Worth a read.`,
  ];
  
  const tweet = templates[Math.floor(Math.random() * templates.length)];
  const full = `${tweet}\n${url}`;
  
  // Keep under 160 for free tier
  if (full.length > 160) {
    return `New: ${title}\n${url}`;
  }
  
  return full;
}

const PORT = parseInt(process.env.WEBHOOK_PORT || "18790", 10);
const SECRET = getSecretToken();

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req: Request) {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === "/health" && req.method === "GET") {
      return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Blog webhook
    if (url.pathname === "/webhook/blog-publish" && req.method === "POST") {
      try {
        const headerToken = req.headers.get("x-blog-webhook-token");

        if (!headerToken || headerToken !== SECRET) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const payload = (await req.json()) as { url?: string; status?: string };

        if (!payload.url || payload.status !== "published") {
          return new Response(
            JSON.stringify({
              error: "Invalid payload. Need: { url, status: 'published' }",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Fetch blog post
        const post = await fetchBlogPost(payload.url);

        // Generate tweet
        const tweet = generateTweet(post.title, post.url);

        // Save to file for processing
        const dataDir = join(homedir(), ".clawdbot", "webhooks");
        if (!existsSync(dataDir)) {
          mkdirSync(dataDir, { recursive: true });
        }

        const filename = `blog-${Date.now()}.json`;
        const filepath = join(dataDir, filename);

        writeFileSync(
          filepath,
          JSON.stringify(
            {
              timestamp: new Date().toISOString(),
              post,
              tweet,
              status: "pending",
            },
            null,
            2
          )
        );

        return new Response(
          JSON.stringify({
            success: true,
            post,
            tweet,
            message: "Blog post webhook received. Tweet generated.",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (err) {
        console.error("Webhook error:", err);
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // 404
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
});

console.log(`✅ Webhook server listening on http://0.0.0.0:${PORT}`);
console.log(`   Blog webhook: POST http://0.0.0.0:${PORT}/webhook/blog-publish`);
console.log(`   Health check: GET http://0.0.0.0:${PORT}/health`);
