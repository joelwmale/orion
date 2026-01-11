import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import type { calendar_v3 } from "googleapis";
import { createEvent, listEvents, updateEvent } from "./gcal";

type ProfileName = "personal" | "work";

const DISPLAY_TIME_ZONE = "Australia/Brisbane";

type ToolConfig = {
  credentialsPath: string;
  profiles: Record<ProfileName, { tokenPath: string; calendarId: string }>;
};

function defaultConfig(): ToolConfig {
  const base = join(homedir(), ".clawdbot", "credentials", "google-calendar");
  return {
    credentialsPath: join(base, "credentials.json"),
    profiles: {
      personal: {
        tokenPath: join(base, "token-personal.json"),
        calendarId: "primary",
      },
      work: {
        tokenPath: join(base, "token-work.json"),
        calendarId: "primary",
      },
    },
  };
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

function mustString(args: Record<string, any>, key: string): string {
  const v = args[key];
  if (!v || typeof v !== "string") throw new Error(`Missing --${key}`);
  return v;
}

function readConfig(path: string | undefined): ToolConfig {
  const base = defaultConfig();
  if (!path) return base;
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  return {
    ...base,
    ...parsed,
    profiles: {
      ...base.profiles,
      ...(parsed.profiles ?? {}),
    },
  };
}

function getDateRange(days: number) {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return { nowIso: now.toISOString(), endIso: end.toISOString() };
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(`
Google Calendar (Orion)

Credentials location (default):
  ~/.clawdbot/credentials/google-calendar/credentials.json

Setup:
  bun run calendar:init -- --profile personal
  bun run calendar:init -- --profile work

List upcoming events:
  bun run calendar:upcoming -- --profile all --days 7

Create event:
  bun run calendar:create -- --profile work --title "My Event" --start "2026-01-12T10:00" --duration-min 180 --invite a@b.com

Options:
  --config <path>   JSON overrides for token/calendarId paths
  --pretty          Group by day and simplify times

Create options:
  --title <text>
  --start <YYYY-MM-DDTHH:MM>   (interpreted as AEST/Brisbane)
  --duration-min <n>
  --invite <email>            (repeatable via comma-separated)
  --description <text>
  --location <text>
  --reauth            Re-authorize with write scope
`);
}

function formatRawEvent(e: calendar_v3.Schema$Event) {
  const start = e.start?.dateTime ?? e.start?.date ?? "";
  const end = e.end?.dateTime ?? e.end?.date ?? "";
  const summary = e.summary ?? "(no title)";
  const location = e.location ? ` @ ${e.location}` : "";
  return `${start} - ${end} | ${summary}${location}`;
}

function eventDateKey(e: calendar_v3.Schema$Event): string {
  if (e.start?.date) return e.start.date;

  const start = e.start?.dateTime;
  if (!start) return "(unknown date)";

  return dateKeyInTimeZone(new Date(start), DISPLAY_TIME_ZONE);
}

function timeRangeLabel(e: calendar_v3.Schema$Event): string {
  const startDateTime = e.start?.dateTime;
  const endDateTime = e.end?.dateTime;

  if (!startDateTime || !endDateTime) return "All-day";

  const start = new Date(startDateTime);
  const end = new Date(endDateTime);

  const startLabel = formatTime12h(start, DISPLAY_TIME_ZONE);
  const endLabel = formatTime12h(end, DISPLAY_TIME_ZONE);
  return `${startLabel}–${endLabel}`;
}

function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) return "(unknown date)";
  return `${year}-${month}-${day}`;
}

function formatTime12h(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);

  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;
  const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value;

  if (!hour || !minute || !dayPeriod) return "";

  const suffix = dayPeriod.toLowerCase();
  if (minute === "00") return `${hour}${suffix}`;
  return `${hour}:${minute}${suffix}`;
}

function shortenLink(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "meet.google.com") return "Meet";
    return u.hostname;
  } catch {
    return "Link";
  }
}

function labelWithUrl(label: string, url: string) {
  // Telegram linkification works best when the raw URL is present.
  return `${label}: ${url}`;
}

function parseBrisbaneLocalDateTime(input: string): Date {
  // If the user already passed an offset/Z, respect it.
  if (/[zZ]$/.test(input) || /[+-]\d{2}:\d{2}$/.test(input)) {
    return new Date(input);
  }

  // Brisbane is always AEST (no DST): UTC+10.
  // Input is expected to be YYYY-MM-DDTHH:MM.
  return new Date(`${input}:00+10:00`);
}

function dayLabelFromKey(key: string): string {
  if (key === "(unknown date)") return key;
  // Use UTC noon to avoid timezone shifts when formatting the weekday.
  const d = new Date(`${key}T12:00:00Z`);
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.toLocaleDateString("en-US", { day: "2-digit" });
  return `${weekday} ${day} ${month} ${key.slice(0, 4)}`;
}

function printPrettyEvents(events: calendar_v3.Schema$Event[]) {
  const byDay = new Map<string, calendar_v3.Schema$Event[]>();
  for (const e of events) {
    const key = eventDateKey(e);
    const list = byDay.get(key);
    if (list) list.push(e);
    else byDay.set(key, [e]);
  }

  const keys = Array.from(byDay.keys()).sort();
  for (const key of keys) {
    // eslint-disable-next-line no-console
    console.log(dayLabelFromKey(key));
    const dayEvents = byDay.get(key)!;
    for (const e of dayEvents) {
      const summary = e.summary ?? "(no title)";
      const when = timeRangeLabel(e);

      const locationRaw = e.location?.trim();
      const where = locationRaw
        ? locationRaw.startsWith("http")
          ? ` — ${labelWithUrl(shortenLink(locationRaw), locationRaw)}`
          : ` — ${locationRaw}`
        : "";

      const hangoutRaw = e.hangoutLink?.trim();
      const hangout =
        hangoutRaw && hangoutRaw !== locationRaw
          ? ` (${labelWithUrl(shortenLink(hangoutRaw), hangoutRaw)})`
          : "";

      // eslint-disable-next-line no-console
      console.log(`- ${when}  ${summary}${where}${hangout}`);
    }
  }
}

async function run() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (!command || command === "help" || args.help) {
    printHelp();
    return;
  }

  const config = readConfig(args.config as string | undefined);

  if (command === "init") {
    const profile = mustString(args, "profile") as ProfileName;
    const p = config.profiles[profile];

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
    const pretty = Boolean(args.pretty);
    const { nowIso, endIso } = getDateRange(days);

    const profiles: ProfileName[] = profileArg === "all" ? ["personal", "work"] : [profileArg as ProfileName];

    for (const profile of profiles) {
      const p = config.profiles[profile];

      const events = await listEvents({
        credentialsPath: config.credentialsPath,
        tokenPath: p.tokenPath,
        calendarId: p.calendarId,
        timeMin: nowIso,
        timeMax: endIso,
      });

      if (events.length === 0) {
        // Hide empty profiles entirely.
        continue;
      }

      // eslint-disable-next-line no-console
      console.log(`\n== ${profile.toUpperCase()} ==`);

      if (!pretty) {
        for (const e of events) {
          // eslint-disable-next-line no-console
          console.log(formatRawEvent(e));
        }
        continue;
      }

      printPrettyEvents(events);
    }

    return;
  }

  if (command === "create") {
    const profile = mustString(args, "profile") as ProfileName;
    const title = mustString(args, "title");
    const startLocal = mustString(args, "start");
    const durationMin = Number(mustString(args, "duration-min"));
    const reauth = Boolean(args.reauth);

    const inviteRaw = (args.invite as string | undefined) ?? "";
    const attendees = inviteRaw
      ? inviteRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const description = (args.description as string | undefined) ?? undefined;
    const location = (args.location as string | undefined) ?? undefined;

    const p = config.profiles[profile];

    const start = parseBrisbaneLocalDateTime(startLocal);
    if (!Number.isFinite(start.getTime())) throw new Error(`Invalid --start: ${startLocal}`);

    const end = new Date(start.getTime() + durationMin * 60_000);

    // If an event with the same title exists around that time, patch it instead of creating a duplicate.
    const existing = await listEvents({
      credentialsPath: config.credentialsPath,
      tokenPath: p.tokenPath,
      calendarId: p.calendarId,
      timeMin: new Date(start.getTime() - 12 * 60 * 60_000).toISOString(),
      timeMax: new Date(end.getTime() + 12 * 60 * 60_000).toISOString(),
      maxResults: 50,
    });

    const dup = existing.find((e) => (e.summary ?? "").trim() === title.trim());
    if (dup?.id) {
      const patched = await updateEvent({
        credentialsPath: config.credentialsPath,
        tokenPath: p.tokenPath,
        calendarId: p.calendarId,
        eventId: dup.id,
        summary: title,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        timeZone: DISPLAY_TIME_ZONE,
        attendees,
        description,
        location,
      });

      // eslint-disable-next-line no-console
      console.log(`Updated event: ${patched.htmlLink ?? patched.id ?? "(unknown)"}`);
      return;
    }

    const created = await createEvent({
      credentialsPath: config.credentialsPath,
      tokenPath: p.tokenPath,
      calendarId: p.calendarId,
      summary: title,
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      timeZone: DISPLAY_TIME_ZONE,
      attendees,
      description,
      location,
      forceReauth: reauth,
    });

    // eslint-disable-next-line no-console
    console.log(`Created event: ${created.htmlLink ?? created.id ?? "(unknown)"}`);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(String(err?.stack ?? err));
  process.exitCode = 1;
});
