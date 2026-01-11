import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface PirschConfig {
  client_id: string;
  client_secret: string;
  website_id: string;
}

interface AnalyticsResult {
  website_id: string;
  period: string;
  visitors: number;
  views: number;
  growth: {
    visitors: number;
    views: number;
  };
  daily_breakdown: Array<{
    day: string;
    visitors: number;
    views: number;
    sessions: number;
    bounce_rate: number;
  }>;
}

function loadConfig(): PirschConfig {
  const path = join(homedir(), ".clawdbot", "credentials", "pirsch-analytics.json");
  if (!existsSync(path)) {
    throw new Error(`Pirsch config not found at ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
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

async function fetchAnalytics(
  websiteId: string,
  days: number = 7
): Promise<AnalyticsResult> {
  const config = loadConfig();
  const token = await getAccessToken(config.client_id, config.client_secret);

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (d: Date) => d.toISOString().split("T")[0];
  const from = formatDate(startDate);
  const to = formatDate(endDate);

  const authHeader = `Bearer ${token}`;

  // Fetch overview stats
  const statsRes = await fetch(
    `https://api.pirsch.io/api/v1/statistics/overview?id=${websiteId}&from=${from}&to=${to}`,
    {
      headers: {
        Authorization: authHeader,
      },
    }
  );

  if (!statsRes.ok) {
    throw new Error(
      `Pirsch API error: ${statsRes.status} ${statsRes.statusText}`
    );
  }

  const stats = (await statsRes.json()) as {
    visitors?: number;
    views?: number;
    visitors_growth?: number;
    views_growth?: number;
    visitors_time_series?: Array<{
      day: string;
      visitors: number;
      views: number;
      sessions: number;
      bounce_rate: number;
    }>;
  };

  const timeSeries = stats.visitors_time_series || [];
  const dailyBreakdown = timeSeries.map((entry) => ({
    day: entry.day.split("T")[0],
    visitors: entry.visitors || 0,
    views: entry.views || 0,
    sessions: entry.sessions || 0,
    bounce_rate: entry.bounce_rate || 0,
  }));

  return {
    website_id: websiteId,
    period: `${from} to ${to}`,
    visitors: stats.visitors ?? 0,
    views: stats.views ?? 0,
    growth: {
      visitors: stats.visitors_growth ?? 0,
      views: stats.views_growth ?? 0,
    },
    daily_breakdown: dailyBreakdown,
  };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "help") {
    // eslint-disable-next-line no-console
    console.log(`
Pirsch Analytics

Usage:
  pirsch-analytics <website_id> [days]
  
Examples:
  pirsch-analytics zy1bBvG1lv 7      # Last 7 days
  pirsch-analytics zy1bBvG1lv 30     # Last 30 days
    `);
    return;
  }

  const websiteId = command;
  const days = args[0] ? parseInt(args[0], 10) : 7;

  if (isNaN(days) || days < 1) {
    // eslint-disable-next-line no-console
    console.error("Days must be a positive number");
    process.exitCode = 1;
    return;
  }

  try {
    const analytics = await fetchAnalytics(websiteId, days);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(analytics, null, 2));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(String(err?.message ?? err));
    process.exitCode = 1;
  }
}

main();
