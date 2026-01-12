import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";

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

function loadEnvFile(path: string): Record<string, string> {
  try {
    const raw = readFileSync(path, "utf8");
    const out: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function runTool(label: string, cmd: string, cmdArgs: string[]) {
  const env = { ...process.env, ...loadEnvFile("/root/.clawdbot/env") };
  const res = spawnSync(cmd, cmdArgs, { encoding: "utf8", env });
  if (res.status !== 0) {
    // eslint-disable-next-line no-console
    console.log(`\n== ${label} ==`);
    // eslint-disable-next-line no-console
    console.log(res.stdout.trim());
    // eslint-disable-next-line no-console
    console.log(String(res.stderr || "").trim());
    return;
  }

  const out = res.stdout.trim();
  if (!out) return;

  // eslint-disable-next-line no-console
  console.log(out);
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(`
Orion Daily Summary

Usage:
  bun run orion:today

Options:
  --days <n>        Calendar window (default 1)
  --stale-days <n>  Stale email threshold (default 7)
  --stale-max <n>   Max candidate threads to inspect per profile (default 30)
  --stale-limit <n> Max rows shown per section (default 10)
`);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (!command || command === "help" || args.help) {
    printHelp();
    return;
  }

  if (command !== "today") throw new Error(`Unknown command: ${command}`);

  const days = Number((args.days as string | undefined) ?? "1");
  const staleDays = Number((args["stale-days"] as string | undefined) ?? "7");
  const staleMax = Number((args["stale-max"] as string | undefined) ?? "30");
  const staleLimit = Number((args["stale-limit"] as string | undefined) ?? "10");

  // Calendar (next 24h)
  runTool(
    "CALENDAR",
    "bun",
    ["tools/google-calendar/cli.ts", "upcoming", "--profile", "all", "--days", String(days), "--pretty"]
  );

  // Important inbox today
  runTool(
    "EMAIL TODAY",
    "bun",
    ["tools/google-gmail/cli.ts", "today", "--profile", "all", "--pretty", "--important"]
  );

  // Commitments you made today
  runTool(
    "COMMITMENTS",
    "bun",
    ["tools/google-gmail/cli.ts", "commitments", "--profile", "all", "--pretty"]
  );

  // Stale follow-ups and owed replies
  runTool(
    "STALE",
    "bun",
    [
      "tools/google-gmail/cli.ts",
      "stale",
      "--profile",
      "all",
      "--days",
      String(staleDays),
      "--pretty",
      "--max",
      String(staleMax),
      "--limit",
      String(staleLimit),
    ]
  );

  // GitHub dependency vulns (Dependabot)
  runTool(
    "GITHUB VULNS",
    "bun",
    ["tools/orion/github-vulns.ts", "check", "--limit", "5"]
  );

  // TODOs
  const todoPath = "/root/clawd/TODO.md";
  if (existsSync(todoPath)) {
    const todoContent = readFileSync(todoPath, "utf8").trim();
    if (todoContent) {
      // eslint-disable-next-line no-console
      console.log("\n== TODOS ==");
      // eslint-disable-next-line no-console
      console.log(todoContent);
    }
  }

  // Analytics (7-day summary)
  runTool(
    "ANALYTICS",
    "bun",
    ["tools/orion/analytics-summary.ts"]
  );
}

main();
