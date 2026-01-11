import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

type IgnoreConfig = {
  stale?: {
    followUpsThreadIds?: string[];
    oweRepliesThreadIds?: string[];
    doneFollowUpsThreadIds?: string[];
    doneOweRepliesThreadIds?: string[];
  };
};

type StaleCache = {
  createdAtMs: number;
  days: number;
  profiles: Record<
    string,
    {
      awaitingThem: { threadId: string; subject?: string; age?: string; permalink?: string }[];
      awaitingMe: { threadId: string; from?: string; subject?: string; age?: string; permalink?: string }[];
    }
  >;
};

function ignorePath() {
  return join(homedir(), ".clawdbot", "config", "gmail-ignore.json");
}

function staleCachePath() {
  return join(homedir(), ".clawdbot", "cache", "gmail-stale-last.json");
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readIgnore(): IgnoreConfig {
  try {
    return readJson<IgnoreConfig>(ignorePath());
  } catch {
    return {};
  }
}

function writeIgnore(cfg: IgnoreConfig) {
  const path = ignorePath();
  mkdirSync(join(homedir(), ".clawdbot", "config"), { recursive: true });
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

function readStaleCache(): StaleCache {
  return readJson<StaleCache>(staleCachePath());
}

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

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(`
Gmail Triage Helper

Workflow:
  1) Run stale scan (this writes a cache):
     bun run gmail:stale -- --profile all --days 7 --pretty

  2) Mark items as done/ignored by number from the list you just saw:
     bun run gmail:triage -- --action done --kind followups --profile work --index 1
     bun run gmail:triage -- --action ignore --kind owereplies --profile personal --index 2

Options:
  --action <done|ignore>
  --kind <followups|owereplies>
  --profile <personal|work>
  --index <n>   1-based index in that section

Notes:
  The mapping comes from ~/.clawdbot/cache/gmail-stale-last.json
`);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (!command || command === "help" || args.help) {
    printHelp();
    return;
  }

  if (command !== "triage") throw new Error(`Unknown command: ${command}`);

  const action = String(args.action ?? "");
  const kind = String(args.kind ?? "");
  const profile = String(args.profile ?? "");
  const index = Number(args.index ?? "0");

  if (!action || (action !== "ignore" && action !== "done")) {
    throw new Error("Missing/invalid --action (ignore|done)");
  }
  if (!kind || (kind !== "followups" && kind !== "owereplies")) {
    throw new Error("Missing/invalid --kind (followups|owereplies)");
  }
  if (!profile || (profile !== "personal" && profile !== "work")) {
    throw new Error("Missing/invalid --profile (personal|work)");
  }
  if (!Number.isFinite(index) || index < 1) {
    throw new Error("Missing/invalid --index (1-based)");
  }

  const cache = readStaleCache();
  const section = cache.profiles[profile];
  if (!section) throw new Error(`No cached results for profile: ${profile}`);

  const list = kind === "followups" ? section.awaitingThem : section.awaitingMe;
  const item = list[index - 1];
  if (!item?.threadId) {
    throw new Error(`No item at index ${index} for ${kind} ${profile}`);
  }

  const cfg = readIgnore();
  cfg.stale ??= {};

  const listKey =
    kind === "followups"
      ? action === "ignore"
        ? "followUpsThreadIds"
        : "doneFollowUpsThreadIds"
      : action === "ignore"
        ? "oweRepliesThreadIds"
        : "doneOweRepliesThreadIds";

  // @ts-expect-error dynamic key
  cfg.stale[listKey] ??= [];
  // @ts-expect-error dynamic key
  if (!cfg.stale[listKey].includes(item.threadId)) cfg.stale[listKey].push(item.threadId);

  writeIgnore(cfg);
  // eslint-disable-next-line no-console
  console.log(`${action === "done" ? "Done" : "Ignored"} [thread:${item.threadId}] for ${kind} (${profile}).`);
}

main();
