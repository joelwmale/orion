import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface PirschConfig {
  client_id: string;
  client_secret: string;
  website_id: string;
}

interface BlogPostAnalytics {
  slug: string;
  path: string;
  period: string;
  visitors: number;
  views: number;
  sessions: number | null;
  bounce_rate: number | null;
  growth: {
    visitors: number;
    views: number;
  };
}

function loadConfig(): PirschConfig {
  const path = join(homedir(), ".clawdbot", "credentials", "pirsch-analytics.json");
  if (!existsSync(path)) {
    throw new Error(`Pirsch config not found at ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch("https://api.pirsch.io/api/v1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("No access_token in response");
  }

  return data.access_token;
}

async function fetchBlogPostAnalytics(
  slug: string,
  days: number = 14
): Promise<BlogPostAnalytics> {
  const config = loadConfig();
  const token = await getAccessToken(config.client_id, config.client_secret);

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (d: Date) => d.toISOString().split("T")[0];
  const from = formatDate(startDate);
  const to = formatDate(endDate);

  const path = `/blog/${slug}`;
  const authHeader = `Bearer ${token}`;

  // Fetch analytics for the specific blog post
  const res = await fetch(
    `https://api.pirsch.io/api/v1/statistics/overview?id=${config.website_id}&from=${from}&to=${to}&path=${encodeURIComponent(path)}`,
    {
      headers: {
        Authorization: authHeader,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Pirsch API error: ${res.status} ${res.statusText}`);
  }

  const stats = (await res.json()) as {
    visitors?: number;
    views?: number;
    sessions?: number | null;
    bounce_rate?: number | null;
    visitors_growth?: number;
    views_growth?: number;
  };

  return {
    slug,
    path,
    period: `${from} to ${to}`,
    visitors: stats.visitors ?? 0,
    views: stats.views ?? 0,
    sessions: stats.sessions ?? null,
    bounce_rate: stats.bounce_rate ?? null,
    growth: {
      visitors: stats.visitors_growth ?? 0,
      views: stats.views_growth ?? 0,
    },
  };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "help") {
    // eslint-disable-next-line no-console
    console.log(`
Blog Post Analytics

Usage:
  blog-analytics <slug> [days]
  blog-analytics "<title>" [days]   # Auto-slugify from title
  
Examples:
  blog-analytics use-bun-as-your-package-manager-in-any-laravel-project 14
  blog-analytics "Use Bun as your package manager in any Laravel project" 7
  blog-analytics "My Post Title" 30
    `);
    return;
  }

  // If the command looks like a full title (has spaces), slugify it
  // Otherwise treat it as an already-slugified slug
  const slug = command.includes(" ") ? slugify(command) : command;
  const days = args[0] ? parseInt(args[0], 10) : 14;

  if (isNaN(days) || days < 1) {
    // eslint-disable-next-line no-console
    console.error("Days must be a positive number");
    process.exitCode = 1;
    return;
  }

  try {
    const analytics = await fetchBlogPostAnalytics(slug, days);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(analytics, null, 2));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(String(err?.message ?? err));
    process.exitCode = 1;
  }
}

main();
