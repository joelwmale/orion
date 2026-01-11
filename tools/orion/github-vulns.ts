import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

type RepoConfig = { repos: string[] };

type DependabotAlert = {
  number: number;
  state: string;
  html_url: string;
  dependency?: {
    package?: { ecosystem?: string; name?: string };
    manifest_path?: string;
    scope?: string;
  };
  security_advisory?: {
    severity?: string;
    summary?: string;
    cve_id?: string | null;
    ghsa_id?: string | null;
  };
  security_vulnerability?: {
    package?: { ecosystem?: string; name?: string };
    severity?: string;
    vulnerable_version_range?: string;
    first_patched_version?: { identifier?: string };
  };
  created_at?: string;
  updated_at?: string;
};

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) continue;
    const [k, v] = a.slice(2).split("=");
    if (v !== undefined) {
      args[k!] = v;
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[k!] = next;
        i++;
      } else {
        args[k!] = true;
      }
    }
  }
  return args;
}

function readReposFromConfig(): string[] {
  const path = join(homedir(), ".clawdbot", "config", "orion-repos.json");
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as RepoConfig;
    return Array.isArray(parsed.repos) ? parsed.repos.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function ghJson(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const ghPath = process.env.GH_PATH?.trim() || "gh";
  const res = spawnSync(ghPath, args, { encoding: "utf8" });
  return {
    ok: res.status === 0,
    stdout: (res.stdout ?? "").toString(),
    stderr: (res.stderr ?? "").toString(),
  };
}

async function githubApiJson(path: string): Promise<{ ok: boolean; status: number; body: string }> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    return { ok: false, status: 0, body: "Missing GITHUB_TOKEN (or GH_TOKEN)" };
  }

  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "clawdbot-orion",
    },
  });

  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

function isHighOrCritical(sev: string | undefined) {
  const s = (sev ?? "").toLowerCase();
  return s === "high" || s === "critical";
}

function isNpmOrComposer(ecosystem: string | undefined) {
  const e = (ecosystem ?? "").toLowerCase();
  return e === "npm" || e === "composer";
}

function alertTitle(a: DependabotAlert) {
  const pkg = a.security_vulnerability?.package?.name ?? a.dependency?.package?.name ?? "(unknown package)";
  const sev = (a.security_vulnerability?.severity ?? a.security_advisory?.severity ?? "").toUpperCase();
  const id = a.security_advisory?.cve_id ?? a.security_advisory?.ghsa_id ?? `#${a.number}`;
  const summary = a.security_advisory?.summary ?? "";
  return `${sev} ${pkg} (${id})${summary ? ` — ${summary}` : ""}`;
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(`
GitHub Dependency Vulnerabilities (Orion)

Reads open Dependabot alerts and reports only HIGH/CRITICAL for npm/composer.

Config:
  ~/.clawdbot/config/orion-repos.json  (repos array)

Usage:
  bun run orion:vulns
  bun run orion:vulns -- --limit 5
`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (!command || command === "help" || args.help) {
    printHelp();
    return;
  }

  if (command !== "check") throw new Error(`Unknown command: ${command}`);

  const limit = Number((args.limit as string | undefined) ?? "5");
  const repos = readReposFromConfig();

  if (repos.length === 0) {
    // eslint-disable-next-line no-console
    console.log("No repos configured. Add them to ~/.clawdbot/config/orion-repos.json");
    return;
  }

  for (const repo of repos) {
    // Prefer gh if available, otherwise use GitHub API directly.
    let raw = "";
    let err = "";

    const ghRes = ghJson([
      "api",
      "--paginate",
      "-H",
      "Accept: application/vnd.github+json",
      `repos/${repo}/dependabot/alerts?state=open&per_page=100`,
    ]);

    if (ghRes.ok) {
      raw = ghRes.stdout;
    } else {
      const api = await githubApiJson(
        `repos/${repo}/dependabot/alerts?state=open&per_page=100`
      );
      if (!api.ok) {
        err = api.body || ghRes.stderr || ghRes.stdout;
      } else {
        raw = api.body;
      }
    }

    if (!raw) {
      // eslint-disable-next-line no-console
      console.log(`\n== ${repo} ==`);
      // eslint-disable-next-line no-console
      console.log(
        `Could not fetch Dependabot alerts. ${String(err).trim() || "(no details)"}`
      );
      continue;
    }

    let alerts: DependabotAlert[] = [];
    try {
      alerts = JSON.parse(raw) as DependabotAlert[];
    } catch {
      // eslint-disable-next-line no-console
      console.log(`\n== ${repo} ==`);
      // eslint-disable-next-line no-console
      console.log("Could not parse GitHub API response.");
      continue;
    }

    const filtered = alerts.filter((a) => {
      const sev = a.security_vulnerability?.severity ?? a.security_advisory?.severity;
      const eco = a.security_vulnerability?.package?.ecosystem ?? a.dependency?.package?.ecosystem;
      return isHighOrCritical(sev) && isNpmOrComposer(eco);
    });

    if (filtered.length === 0) continue;

    // eslint-disable-next-line no-console
    console.log(`\n== ${repo} (DEPENDABOT: HIGH/CRITICAL) ==`);
    for (const a of filtered.slice(0, Math.max(1, limit))) {
      // eslint-disable-next-line no-console
      console.log(`- ${alertTitle(a)}`);
      // eslint-disable-next-line no-console
      console.log(`  ${a.html_url}`);
    }

    if (filtered.length > limit) {
      // eslint-disable-next-line no-console
      console.log(`  …and ${filtered.length - limit} more`);
    }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(String(err?.stack ?? err));
  process.exitCode = 1;
});
