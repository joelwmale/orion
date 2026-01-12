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

function loadConfig(project: string = "joelmale"): PirschConfig {
  // Support multiple projects: joelmale, rethread, etc.
  const filename = project === "rethread" ? "pirsch-rethread.json" : "pirsch-analytics.json";
  const path = join(homedir(), ".clawdbot", "credentials", filename);
  if (!existsSync(path)) {
    throw new Error(`Pirsch config not found at ${path}`);
  }
  
  const config = JSON.parse(readFileSync(path, "utf8"));
  
  // Handle both website_id and dashboard_id naming
  if (!config.website_id && config.dashboard_id) {
    config.website_id = config.dashboard_id;
  }
  
  return config;
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
  days: number = 14,
  project: string = "joelmale"
): Promise<BlogPostAnalytics> {
  const config = loadConfig(project);
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
  blog-analytics [project] <slug> [days]
  blog-analytics [project] "<title>" [days]   # Auto-slugify from title
  
Projects: joelmale (default), rethread

Examples:
  blog-analytics use-bun-as-your-package-manager-in-any-laravel-project 14
  blog-analytics "Use Bun as your package manager in any Laravel project" 7
  blog-analytics rethread "School Uniform Budgeting" 30
    `);
    return;
  }

  // Check if first arg is a project name
  let project = "joelmale";
  let slug = command;
  let daysArg = args[0];
  
  if (command === "joelmale" || command === "rethread") {
    project = command;
    slug = args[0];
    daysArg = args[1];
  }

  // If the slug looks like a full title (has spaces), slugify it
  // Otherwise treat it as an already-slugified slug
  const slugFinal = slug.includes(" ") ? slugify(slug) : slug;
  const days = daysArg ? parseInt(daysArg, 10) : 14;

  if (isNaN(days) || days < 1) {
    // eslint-disable-next-line no-console
    console.error("Days must be a positive number");
    process.exitCode = 1;
    return;
  }

  try {
    const analytics = await fetchBlogPostAnalytics(slugFinal, days, project);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(analytics, null, 2));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(String(err?.message ?? err));
    process.exitCode = 1;
  }
}

main();
