import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Generate a random token
function generateToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Load or create token
function getSecretToken(): string {
  const tokenPath = join(homedir(), ".clawdbot", "credentials", "blog-webhook-token.txt");
  
  if (existsSync(tokenPath)) {
    return readFileSync(tokenPath, "utf8").trim();
  }
  
  const token = generateToken();
  const dir = join(homedir(), ".clawdbot", "credentials");
  
  // Ensure directory exists
  if (!existsSync(dir)) {
    throw new Error(`Directory ${dir} does not exist. Create it first.`);
  }
  
  writeFileSync(tokenPath, token, { mode: 0o600 });
  console.log(`Generated new token: ${token}`);
  return token;
}

// Fetch and parse blog post
async function fetchBlogPost(url: string): Promise<string> {
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
  
  return JSON.stringify({ title, excerpt, url });
}

// Generate tweet in Joel's voice
function generateTweet(title: string, url: string): string {
  // Pattern: Problem/context -> solution with link
  const tweets = [
    `New post: "${title}"`,
    `Just wrote about: ${title}. Check it out.`,
    `${title}. Worth a read.`,
  ];
  
  const tweet = tweets[Math.floor(Math.random() * tweets.length)];
  const full = `${tweet}\n${url}`;
  
  // Keep under 160 for free tier
  if (full.length > 160) {
    return `New: ${title}\n${url}`;
  }
  
  return full;
}

// Main webhook handler
export async function handleBlogPublish(req: Request, secret: string): Promise<Response> {
  // Validate token
  const headerToken = req.headers.get("X-Blog-Webhook-Token");
  
  if (!headerToken || headerToken !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  
  try {
    const payload = await req.json() as { url?: string; status?: string };
    
    if (!payload.url || payload.status !== "published") {
      return new Response(JSON.stringify({ error: "Invalid payload. Need: { url, status: 'published' }" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Fetch blog post
    const postData = await fetchBlogPost(payload.url);
    const post = JSON.parse(postData);
    
    // Generate tweet
    const tweet = generateTweet(post.title, post.url);
    
    return new Response(
      JSON.stringify({
        success: true,
        post: post,
        tweet: tweet,
        message: "Blog post webhook received. Tweet generated (not posted yet—manual review needed).",
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

// CLI: get the token
if (import.meta.main) {
  const token = getSecretToken();
  console.log(`\nBlog Webhook Token:\n${token}`);
  console.log(`\nWebhook URL: http://your-clawdbot-url:PORT/webhook/blog-publish`);
  console.log(`\nPOST payload:\n{\n  "url": "https://joelmale.com/blog/post-slug",\n  "status": "published"\n}`);
  console.log(`\nHeader:\nX-Blog-Webhook-Token: ${token}\n`);
}
