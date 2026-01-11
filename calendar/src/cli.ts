import { readFileSync } from "node:fs";
import { defaultConfig, type ProfileName } from "./config";
import { listEvents, formatEvent } from "./gcal";

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

function mustString(args: Record<string, any>, key: string): string {
  const v = args[key];
  if (!v || typeof v !== "string") throw new Error(`Missing --${key}`);
  return v;
}

function getDateRange(days: number) {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return { nowIso: now.toISOString(), endIso: end.toISOString() };
}

async function run() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (!command || command === "help" || args.help) {
    printHelp();
    return;
  }

  const configPath = (args.config as string | undefined) ?? "config/calendars.json";
  const config = readConfig(configPath);

  if (command === "init") {
    const profile = mustString(args, "profile") as ProfileName;
    const p = config.profiles[profile];
    // Trigger auth.
    await listEvents({
      credentialsPath: config.credentialsPath,
      tokenPath: p.tokenPath,
      calendarId: p.calendarId,
      timeMin: new Date().toISOString(),
      timeMax: new Date(Date.now() + 60_000).toISOString(),
      maxResults: 1,
    });
    // eslint-disable-next-line no-console
    console.log(`Linked Google Calendar profile: ${profile}`);
    return;
  }

  if (command === "upcoming") {
    const profileArg = (args.profile as string | undefined) ?? "all";
    const days = Number((args.days as string | undefined) ?? "7");
    const { nowIso, endIso } = getDateRange(days);

    const profiles: ProfileName[] = profileArg === "all" ? ["personal", "work"] : [profileArg as ProfileName];

    for (const profile of profiles) {
      const p = config.profiles[profile];
      // eslint-disable-next-line no-console
      console.log(`\n== ${profile.toUpperCase()} ==`);
      const events = await listEvents({
        credentialsPath: config.credentialsPath,
        tokenPath: p.tokenPath,
        calendarId: p.calendarId,
        timeMin: nowIso,
        timeMax: endIso,
      });

      if (events.length === 0) {
        // eslint-disable-next-line no-console
        console.log("(no events)");
      } else {
        for (const e of events) {
          // eslint-disable-next-line no-console
          console.log(formatEvent(e));
        }
      }
    }

    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function readConfig(path: string) {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  return {
    ...defaultConfig,
    ...parsed,
    profiles: {
      ...defaultConfig.profiles,
      ...(parsed.profiles ?? {}),
    },
  };
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(`
Orion Google Calendar CLI

Setup:
  bun run calendar:init -- --profile personal
  bun run calendar:init -- --profile work

List upcoming events:
  bun run calendar:upcoming -- --profile all --days 7
  bun run calendar:upcoming -- --profile personal --days 1

Options:
  --config config/calendars.json
`);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(String(err?.stack ?? err));
  process.exitCode = 1;
});
