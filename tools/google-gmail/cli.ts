import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { getMessageBodyText, getMessageSnippet, getThread, listMessageSummaries, type GmailMessageSummary } from "./gmail";

type ProfileName = "personal" | "work";

const DISPLAY_TIME_ZONE = "Australia/Brisbane";

type ToolConfig = {
  credentialsPath: string;
  profiles: Record<ProfileName, { tokenPath: string }>;
};

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

function defaultConfig(): ToolConfig {
  const base = join(homedir(), ".clawdbot", "credentials", "google-gmail");
  return {
    credentialsPath: join(base, "credentials.json"),
    profiles: {
      personal: { tokenPath: join(base, "token-personal.json") },
      work: { tokenPath: join(base, "token-work.json") },
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

function defaultIgnorePath() {
  return join(homedir(), ".clawdbot", "config", "gmail-ignore.json");
}

function defaultStaleCachePath() {
  return join(homedir(), ".clawdbot", "cache", "gmail-stale-last.json");
}

function readIgnoreConfig(): IgnoreConfig {
  const path = defaultIgnorePath();
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as IgnoreConfig;
  } catch {
    return {};
  }
}

function writeStaleCache(cache: StaleCache) {
  const path = defaultStaleCachePath();
  mkdirSync(join(homedir(), ".clawdbot", "cache"), { recursive: true });
  writeFileSync(path, JSON.stringify(cache, null, 2) + "\n", "utf8");
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(`
Google Gmail (Orion)

Credentials location (default):
  ~/.clawdbot/credentials/google-gmail/credentials.json

Setup:
  bun run gmail:init -- --profile personal
  bun run gmail:init -- --profile work

List last 24h (in AEST/Brisbane):
  bun run gmail:recent -- --profile all --hours 24 --pretty

List today (in AEST/Brisbane):
  bun run gmail:today -- --profile all --pretty

Scan commitments you made today (sent mail):
  bun run gmail:commitments -- --profile all --pretty

Scan stale threads (no reply in N days):
  bun run gmail:stale -- --profile all --days 7 --pretty

Options:
  --config <path>     JSON overrides for token paths
  --pretty            Human-readable list
  --json              JSON output (for automations)
  --important         Filter out noise (promos/CI/etc)
  --max <n>           Max messages per profile
  --days <n>          For gmail:stale (default 7)
  --limit <n>         Limit output rows (default 15)

Notes:
  You can suppress specific false positives by adding thread IDs to:
    ~/.clawdbot/config/gmail-ignore.json
`);
}

function isCiNoise(m: GmailMessageSummary): boolean {
  const from = (m.from ?? "").toLowerCase();
  const subject = (m.subject ?? "").toLowerCase();

  if (from.includes("notifications@github.com")) {
    if (subject.includes("run failed") || subject.includes("workflow") || subject.includes("checks")) return true;
  }

  return false;
}

function isPromotion(m: GmailMessageSummary): boolean {
  const labels = new Set((m.labels ?? []).map((x) => x.toUpperCase()));
  if (labels.has("CATEGORY_PROMOTIONS")) return true;

  const from = (m.from ?? "").toLowerCase();
  const subject = (m.subject ?? "").toLowerCase();
  if (from.includes("twitch.tv") && subject.includes(" is live")) return true;
  if (subject.includes("sale") || subject.includes("% off")) return true;

  return false;
}

function isShippingRelevant(m: GmailMessageSummary): boolean {
  const hay = `${m.subject ?? ""}\n${m.snippet ?? ""}`.toLowerCase();

  // Stuff you said you care about: "coming today", "out for delivery", "on board" etc.
  const keywords = [
    "out for delivery",
    "on board",
    "onboard",
    "scheduled to arrive",
    "arrive between",
    "coming today",
    "delivery today",
    "delivered",
  ];

  if (keywords.some((k) => hay.includes(k))) return true;

  // Some carriers use generic phrases; keep if it's clearly a shipment notification.
  const carriers = ["auspost", "australia post", "allied express", "team global express", "startrack"]; 
  if (carriers.some((c) => hay.includes(c))) return true;

  return false;
}

function isImportant(m: GmailMessageSummary): boolean {
  if (isCiNoise(m)) return false;
  if (isPromotion(m)) return false;

  // Always keep shipping status changes.
  if (isShippingRelevant(m)) return true;

  // Keep if Gmail already marked it important.
  const labels = new Set((m.labels ?? []).map((x) => x.toUpperCase()));
  if (labels.has("IMPORTANT")) return true;

  // Otherwise, keep a small set of personal/admin that often implies an action.
  const subject = (m.subject ?? "").toLowerCase();
  if (subject.includes("response needed")) return true;
  if (subject.includes("security alert")) return true;

  return false;
}

function looksLikeCommitment(text: string): boolean {
  const t = text.toLowerCase();
  const patterns = [
    "i will ",
    "i'll ",
    "ill ",
    "i can ",
    "i can do ",
    "i can have ",
    "i will have ",
    "i'll have ",
    "sounds good",
    "that works",
    "happy to",
    "no worries",
    "i should be able",
  ];

  return patterns.some((p) => t.includes(p));
}

function stripQuotedReply(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];

  const stopMarkers = [
    /^on\s.+wrote:$/i,
    /^from:\s/i,
    /^sent:\s/i,
    /^to:\s/i,
    /^subject:\s/i,
    /^-{2,}\s*original message\s*-{2,}$/i,
    /^-{2,}\s*forwarded message\s*-{2,}$/i,
    /^thanks[,!\.\s]*$/i,
    /^thank you[,!\.\s]*$/i,
    /^cheers[,!\.\s]*$/i,
    /^regards[,!\.\s]*$/i,
    /^kind regards[,!\.\s]*$/i,
    /^>+\s*/, // quoted lines
  ];

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (stopMarkers.some((re) => re.test(line))) break;

    // Skip obvious quote blocks.
    if (line.trimStart().startsWith(">")) continue;

    out.push(line);
  }

  return out.join("\n").trim();
}

function requiresResponse(text: string): boolean {
  const cleaned = stripQuotedReply(text);
  const head = cleaned.slice(0, 500);
  const t = head.toLowerCase();
  if (!t.trim()) return false;

  // Strong signal.
  if (t.includes("?")) return true;

  // Common follow-up / ask patterns.
  const patterns = [
    "let me know",
    "please let me know",
    "can you",
    "could you",
    "would you",
    "are you able",
    "do you have",
    "any updates",
    "any update",
    "any changes",
    "any change",
    "thoughts",
    "confirm",
    "confirmation",
    "can we",
    "shall we",
  ];

  // Require at least some "second person" indicator so we don't get tripped up by boilerplate.
  const addressed = t.includes(" you ") || t.startsWith("you ") || t.includes("your ");
  if (!addressed) return false;

  return patterns.some((p) => t.includes(p));
}

function extractPossibleDateMentions(text: string): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];

  const phrases = [
    "today",
    "tomorrow",
    "this morning",
    "this afternoon",
    "tonight",
    "next week",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  for (const p of phrases) {
    if (t.includes(p)) out.push(p);
  }

  const numeric = text.match(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g);
  if (numeric) out.push(...numeric);

  return Array.from(new Set(out));
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

  if (!year || !month || !day) return "";
  return `${year}/${month}/${day}`;
}

function queryForLastHours(hours: number) {
  // Gmail supports `after:<unix_timestamp>` (seconds).
  const secondsAgo = Math.max(60, Math.floor(hours * 60 * 60));
  const after = Math.floor((Date.now() - secondsAgo * 1000) / 1000);
  return `after:${after}`;
}

function queryForToday() {
  // Gmail search supports after:YYYY/MM/DD in the user's timezone.
  // We anchor it to Brisbane by computing today's date key in that TZ.
  const key = dateKeyInTimeZone(new Date(), DISPLAY_TIME_ZONE);
  return `after:${key}`;
}

function parseEmailAddress(headerValue: string | undefined): { name?: string; email?: string } {
  if (!headerValue) return {};
  const m = headerValue.match(/^(.*)<([^>]+)>/);
  if (!m) return { email: headerValue.trim() };
  const name = (m[1] ?? "").trim().replace(/^"|"$/g, "");
  const email = (m[2] ?? "").trim();
  return { name: name || undefined, email: email || undefined };
}

function shortFrom(from: string | undefined) {
  const parsed = parseEmailAddress(from);
  return parsed.name ?? parsed.email ?? "";
}

function shortSubject(subject: string | undefined) {
  return (subject ?? "(no subject)").trim();
}

function prettyLine(m: GmailMessageSummary) {
  const from = shortFrom(m.from);
  const subject = shortSubject(m.subject);
  const link = m.permalink ? ` — ${m.permalink}` : "";
  return `- ${from}: ${subject}${link}`;
}

function formatAge(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function isLikelyAutomated(from: string | undefined): boolean {
  const header = (from ?? "").toLowerCase();
  const email = (parseEmailAddress(from).email ?? "").toLowerCase();

  if (header.includes("[bot]")) return true;
  if (header.includes("dependabot")) return true;

  if (!email) return false;
  if (email.startsWith("no-reply@") || email.startsWith("noreply@")) return true;
  if (email.includes("noreply")) return true;
  if (email.endsWith("@notifications.github.com")) return true;

  return false;
}

function isAdminNoise(m: GmailMessageSummary): boolean {
  const subject = (m.subject ?? "").toLowerCase();
  const from = (m.from ?? "").toLowerCase();

  if (subject.startsWith("fwd:")) return true;
  if (subject.startsWith("fw:")) return true;

  const subjectHints = [
    "invoice",
    "receipt",
    "renew",
    "subscription",
    "terms of service",
    "privacy policy",
    "maintenance",
    "auto-renew",
    "payment receipt",
    "payment received",
    "spam report",
    "digest",
    "notification",
    "invitation",
    "invited you",
    "role",
    "has changed",
    "deployment failed",
    "webhook disabled",
    "your access",
    "laravel forge",
    "upwork",
    "amazon.com",
    "out for delivery",
    "shipped",
    "delivered",
    "order #",
    "ordered:",
    "verification code",
    "your code",
    "is your code",
    "security code",
    "one-time",
    "otp",
    "license",
    "statement",
    "bill",
  ];

  if (subjectHints.some((h) => subject.includes(h))) return true;
  if (from.includes("mailer-daemon") || from.includes("postmaster")) return true;

  return false;
}

function shouldIgnoreForStale(m: GmailMessageSummary): boolean {
  // Reuse the main noise filters.
  if (isCiNoise(m) || isPromotion(m)) return true;
  if (isLikelyAutomated(m.from)) return true;
  if (isAdminNoise(m)) return true;

  const labels = new Set((m.labels ?? []).map((x) => x.toUpperCase()));
  // Most of these are FYI; you don't "owe" a reply.
  if (labels.has("CATEGORY_FORUMS")) return true;

  return false;
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

    // Trigger auth with a harmless query.
    await listMessageSummaries({
      credentialsPath: config.credentialsPath,
      tokenPath: p.tokenPath,
      query: "newer_than:1d",
      maxResults: 1,
    });

    // eslint-disable-next-line no-console
    console.log(`Linked Gmail profile: ${profile}`);
    return;
  }

  if (command === "commitments") {
    const profileArg = (args.profile as string | undefined) ?? "all";
    const pretty = Boolean(args.pretty);
    const json = Boolean(args.json);
    const profiles: ProfileName[] = profileArg === "all" ? ["personal", "work"] : [profileArg as ProfileName];

    // "What did I commit to today?" = scan your SENT mail from today (Brisbane date).
    const query = `in:sent ${queryForToday()}`;

    const perProfile: Record<string, any[]> = {};

    for (const profile of profiles) {
      const p = config.profiles[profile];
      const sent = await listMessageSummaries({
        credentialsPath: config.credentialsPath,
        tokenPath: p.tokenPath,
        query,
        maxResults: 50,
      });

      const commitments: any[] = [];
      for (const m of sent) {
        const snippet = await getMessageSnippet({
          credentialsPath: config.credentialsPath,
          tokenPath: p.tokenPath,
          id: m.id,
        });

        if (!looksLikeCommitment(snippet)) continue;

        commitments.push({
          id: m.id,
          to: m.to,
          subject: m.subject,
          dateMentions: extractPossibleDateMentions(snippet),
          permalink: m.permalink,
          snippet,
        });
      }

      if (commitments.length === 0) continue;
      perProfile[profile] = commitments;

      if (json) continue;

      // eslint-disable-next-line no-console
      console.log(`\n== ${profile.toUpperCase()} ==`);
      if (pretty) {
        for (const c of commitments) {
          const subj = (c.subject ?? "(no subject)").trim();
          const dates = (c.dateMentions?.length ?? 0) ? ` [${c.dateMentions.join(", ")}]` : "";
          const link = c.permalink ? ` — ${c.permalink}` : "";
          // eslint-disable-next-line no-console
          console.log(`- ${subj}${dates}${link}`);
        }
      } else {
        for (const c of commitments) {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(c));
        }
      }
    }

    if (json) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ query, timeZone: DISPLAY_TIME_ZONE, profiles: perProfile }, null, 2));
    }

    return;
  }

  if (command === "stale") {
    const profileArg = (args.profile as string | undefined) ?? "all";
    const days = Number((args.days as string | undefined) ?? "7");
    const pretty = Boolean(args.pretty);
    const json = Boolean(args.json);
    const max = args.max ? Number(args.max) : 30;
    const limit = args.limit ? Number(args.limit) : 10;

    const ignore = readIgnoreConfig();
    const ignoreFollowUps = new Set([
      ...(ignore.stale?.followUpsThreadIds ?? []),
      ...(ignore.stale?.doneFollowUpsThreadIds ?? []),
    ]);
    const ignoreOweReplies = new Set([
      ...(ignore.stale?.oweRepliesThreadIds ?? []),
      ...(ignore.stale?.doneOweRepliesThreadIds ?? []),
    ]);

    const profiles: ProfileName[] = profileArg === "all" ? ["personal", "work"] : [profileArg as ProfileName];

    const thresholdMs = Date.now() - days * 24 * 60 * 60 * 1000;

    const awaitingThemQuery = `in:sent older_than:${days}d`;
    const awaitingMeQuery = `in:inbox older_than:${days}d`;

    const perProfile: Record<string, any> = {};

    for (const profile of profiles) {
      const p = config.profiles[profile];

      const awaitingThemCandidates = await listMessageSummaries({
        credentialsPath: config.credentialsPath,
        tokenPath: p.tokenPath,
        query: awaitingThemQuery,
        maxResults: max,
      });

      const awaitingMeCandidates = await listMessageSummaries({
        credentialsPath: config.credentialsPath,
        tokenPath: p.tokenPath,
        query: awaitingMeQuery,
        maxResults: max,
      });

      const awaitingThem: any[] = [];
      const awaitingMe: any[] = [];

      const seenThreads = new Set<string>();

      for (const m of awaitingThemCandidates) {
        if (!m.threadId || !m.internalDateMs) continue;
        if (m.internalDateMs > thresholdMs) continue;
        if (shouldIgnoreForStale(m)) continue;
        if (seenThreads.has(m.threadId)) continue;
        seenThreads.add(m.threadId);

        const thread = await getThread({
          credentialsPath: config.credentialsPath,
          tokenPath: p.tokenPath,
          threadId: m.threadId,
        });

        const sorted = thread
          .filter((x) => x.internalDateMs)
          .sort((a, b) => (a.internalDateMs ?? 0) - (b.internalDateMs ?? 0));
        const last = sorted.at(-1);
        if (!last?.internalDateMs) continue;

        const lastLabels = new Set((last.labels ?? []).map((x) => x.toUpperCase()));
        const lastIsSent = lastLabels.has("SENT");

        // Awaiting them: our last message, and it's older than threshold.
        if (lastIsSent && last.internalDateMs <= thresholdMs) {
          if (shouldIgnoreForStale({ ...m, from: last.from, subject: last.subject, labels: last.labels })) continue;

          const bodyText = await getMessageBodyText({
            credentialsPath: config.credentialsPath,
            tokenPath: p.tokenPath,
            id: last.id,
          });

          // Only surface threads where the last thing we sent looks like it actually
          // asked a question / needs a reply.
          if (!requiresResponse(bodyText)) continue;

        if (ignoreFollowUps.has(last.threadId)) continue;

        awaitingThem.push({
          threadId: last.threadId,
          subject: last.subject ?? m.subject,
          to: last.to,
          lastSentMs: last.internalDateMs,
          lastSentAge: formatAge(Date.now() - last.internalDateMs),
          permalink: m.permalink,
        });
      }
      }

      seenThreads.clear();

      for (const m of awaitingMeCandidates) {
        if (!m.threadId || !m.internalDateMs) continue;
        if (m.internalDateMs > thresholdMs) continue;
        if (shouldIgnoreForStale(m)) continue;
        if (seenThreads.has(m.threadId)) continue;
        seenThreads.add(m.threadId);

        const thread = await getThread({
          credentialsPath: config.credentialsPath,
          tokenPath: p.tokenPath,
          threadId: m.threadId,
        });

        const sorted = thread
          .filter((x) => x.internalDateMs)
          .sort((a, b) => (a.internalDateMs ?? 0) - (b.internalDateMs ?? 0));
        const last = sorted.at(-1);
        if (!last?.internalDateMs) continue;

        const lastLabels = new Set((last.labels ?? []).map((x) => x.toUpperCase()));
        const lastIsSent = lastLabels.has("SENT");

        // Awaiting us: last message is NOT sent by us and it's older than threshold.
        if (!lastIsSent && last.internalDateMs <= thresholdMs && !isLikelyAutomated(last.from)) {
          if (shouldIgnoreForStale({ ...m, from: last.from, subject: last.subject, labels: last.labels })) continue;

          if (ignoreOweReplies.has(last.threadId)) continue;

          awaitingMe.push({
            threadId: last.threadId,
            subject: last.subject ?? m.subject,
            from: last.from,
            lastInboundMs: last.internalDateMs,
            lastInboundAge: formatAge(Date.now() - last.internalDateMs),
            permalink: m.permalink,
          });
        }
      }

      if (awaitingThem.length === 0 && awaitingMe.length === 0) continue;

      perProfile[profile] = {
        awaitingThem: awaitingThem.sort((a, b) => (b.lastSentMs ?? 0) - (a.lastSentMs ?? 0)).slice(0, limit),
        awaitingMe: awaitingMe.sort((a, b) => (b.lastInboundMs ?? 0) - (a.lastInboundMs ?? 0)).slice(0, limit),
      };

      // Persist a small cache so you can ignore items by number.
      // This is updated on each run.
      writeStaleCache({
        createdAtMs: Date.now(),
        days,
        profiles: Object.fromEntries(
          Object.entries(perProfile).map(([k, v]) => [
            k,
            {
              awaitingThem: (v.awaitingThem ?? []).map((x: any) => ({
                threadId: x.threadId,
                subject: x.subject,
                age: x.lastSentAge,
                permalink: x.permalink,
              })),
              awaitingMe: (v.awaitingMe ?? []).map((x: any) => ({
                threadId: x.threadId,
                from: x.from,
                subject: x.subject,
                age: x.lastInboundAge,
                permalink: x.permalink,
              })),
            },
          ])
        ),
      });

      if (json) continue;

      const awaitingThemSorted = awaitingThem
        .sort((a, b) => (b.lastSentMs ?? 0) - (a.lastSentMs ?? 0))
        .slice(0, limit);
      const awaitingMeSorted = awaitingMe
        .sort((a, b) => (b.lastInboundMs ?? 0) - (a.lastInboundMs ?? 0))
        .slice(0, limit);

      if (awaitingThemSorted.length) {
        // eslint-disable-next-line no-console
        console.log(`\n== ${profile.toUpperCase()} (FOLLOW UPS) ==`);
        let i = 1;
        for (const x of awaitingThemSorted) {
          const subj = (x.subject ?? "(no subject)").trim();
          const age = x.lastSentAge ? ` (${x.lastSentAge} ago)` : "";
          const thread = x.threadId ? ` [thread:${x.threadId}]` : "";
          // eslint-disable-next-line no-console
          console.log(`${i}. ${subj}${age}${thread}`);
          if (x.permalink) {
            // eslint-disable-next-line no-console
            console.log(`   ${x.permalink}`);
          }
          i++;
        }
      }

      if (awaitingMeSorted.length) {
        // eslint-disable-next-line no-console
        console.log(`\n== ${profile.toUpperCase()} (YOU OWE REPLIES) ==`);
        let i = 1;
        for (const x of awaitingMeSorted) {
          const subj = (x.subject ?? "(no subject)").trim();
          const from = shortFrom(x.from);
          const age = x.lastInboundAge ? ` (${x.lastInboundAge} ago)` : "";
          const thread = x.threadId ? ` [thread:${x.threadId}]` : "";
          // eslint-disable-next-line no-console
          console.log(`${i}. ${from}: ${subj}${age}${thread}`);
          if (x.permalink) {
            // eslint-disable-next-line no-console
            console.log(`   ${x.permalink}`);
          }
          i++;
        }
      }
    }

    if (json) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ days, timeZone: DISPLAY_TIME_ZONE, profiles: perProfile }, null, 2));
    }

    return;
  }

  if (command === "recent" || command === "today") {
    const profileArg = (args.profile as string | undefined) ?? "all";
    const pretty = Boolean(args.pretty);
    const json = Boolean(args.json);
    const importantOnly = Boolean(args.important);
    const max = args.max ? Number(args.max) : undefined;

    const profiles: ProfileName[] = profileArg === "all" ? ["personal", "work"] : [profileArg as ProfileName];

    let query = "";
    if (command === "today") query = queryForToday();
    else {
      const hours = Number((args.hours as string | undefined) ?? "24");
      query = queryForLastHours(hours);
    }

    const perProfile: Record<string, GmailMessageSummary[]> = {};

    for (const profile of profiles) {
      const p = config.profiles[profile];
      let messages = await listMessageSummaries({
        credentialsPath: config.credentialsPath,
        tokenPath: p.tokenPath,
        query,
        maxResults: max,
      });

      if (importantOnly) messages = messages.filter(isImportant);

      if (messages.length === 0) continue;
      perProfile[profile] = messages;

      if (json) continue;

      // eslint-disable-next-line no-console
      console.log(`\n== ${profile.toUpperCase()} ==`);
      if (!pretty) {
        for (const m of messages) {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(m));
        }
      } else {
        for (const m of messages) {
          // eslint-disable-next-line no-console
          console.log(prettyLine(m));
        }
      }
    }

    if (json) {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          { query, timeZone: DISPLAY_TIME_ZONE, importantOnly, profiles: perProfile },
          null,
          2
        )
      );
    }

    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(String(err?.stack ?? err));
  process.exitCode = 1;
});
