import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface BlogPost {
  id?: number;
  slug?: string;
  title?: string;
  excerpt?: string;
  content?: string;
  meta_description?: string;
  published?: boolean;
}

// Load blog API token
function getApiToken(): string {
  const path = join(homedir(), ".clawdbot", "credentials", "joelmale-blog-token.txt");
  if (!existsSync(path)) {
    throw new Error(`Blog API token not found at ${path}`);
  }
  return readFileSync(path, "utf8").trim();
}

const API_URL = "https://joelmale.com/api";
const TOKEN = getApiToken();

async function getAllPosts(): Promise<BlogPost[]> {
  const res = await fetch(`${API_URL}/blog/posts`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch posts: ${res.status}`);
  }
  
  const data = await res.json() as any;
  return data.data || data;
}

async function getPost(id: number): Promise<BlogPost> {
  const res = await fetch(`${API_URL}/blog/posts/${id}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch post ${id}: ${res.status}`);
  }
  
  return await res.json();
}

async function updatePost(id: number, data: Partial<BlogPost>): Promise<BlogPost> {
  const res = await fetch(`${API_URL}/blog/posts/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to update post ${id}: ${res.status} - ${error}`);
  }
  
  return await res.json();
}

async function main() {
  try {
    console.log("📚 Fetching all blog posts...");
    const posts = await getAllPosts();
    console.log(`Found ${posts.length} posts\n`);

    // Find Bun post
    const bunPost = posts.find(
      (p) => p.slug === "use-bun-as-your-package-manager-in-any-laravel-project"
    );

    if (!bunPost || !bunPost.id) {
      throw new Error("Bun blog post not found");
    }

    console.log(`📖 Found Bun post (ID: ${bunPost.id})\n`);

    // Fetch current post
    const currentPost = await getPost(bunPost.id);
    console.log("Current title:", currentPost.title);
    console.log("Current meta:", currentPost.meta_description, "\n");

    // Prepare updates
    const updates: Partial<BlogPost> = {
      title: "How to Use Bun as Your Package Manager in Laravel (Faster Than npm)",
      meta_description:
        "Set up Bun in Laravel for 10x faster package installation. Step-by-step guide for macOS, Linux, WSL, and Windows.",
      excerpt:
        "Bun is a new JavaScript runtime that's honestly taken over the dev world. If you're using Laravel and still relying on npm or yarn for front-end dependencies, you're missing out. Bun installs packages up to 10x faster.",
      content: currentPost.content
        ? updateContentForSEO(currentPost.content)
        : undefined,
    };

    console.log("✍️  Updating post with SEO improvements...\n");
    console.log("New title:", updates.title);
    console.log("New meta:", updates.meta_description, "\n");

    const updated = await updatePost(bunPost.id, updates);

    console.log("✅ Post updated successfully!");
    console.log("Updated at:", updated.updated_at || new Date().toISOString());
  } catch (err) {
    console.error(`❌ Error: ${err}`);
    process.exit(1);
  }
}

function updateContentForSEO(content: string): string {
  // Replace the opening paragraph with SEO-optimized version
  const seoOpening =
    "<p>Bun is a new JavaScript runtime that's honestly taken over the dev world. If you're using Laravel and still relying on npm or yarn for front-end dependencies, you're missing out. Bun installs packages up to 10x faster, and the setup takes maybe 5 minutes. I'm going to walk you through how to set it up on your system and why I think it's worth the switch.</p>";

  // Replace first <p> tag
  return content.replace(/<p>[^<]*?(?:Bun is|Most Laravel)[^<]*?<\/p>/, seoOpening);
}

main();
