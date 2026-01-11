import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import { getOAuthClient } from "../google-calendar/googleAuth";

export type GmailMessageSummary = {
  id: string;
  threadId?: string;
  internalDateMs?: number;
  from?: string;
  to?: string;
  subject?: string;
  snippet?: string;
  labels?: string[];
  permalink?: string;
};

export type GmailThreadMessage = {
  id: string;
  threadId: string;
  internalDateMs?: number;
  from?: string;
  to?: string;
  subject?: string;
  labels?: string[];
};

export interface ListMessagesParams {
  credentialsPath: string;
  tokenPath: string;
  query: string;
  maxResults?: number;
}

export async function listMessageSummaries(params: ListMessagesParams): Promise<GmailMessageSummary[]> {
  const auth = await getOAuthClient({
    credentialsPath: params.credentialsPath,
    tokenPath: params.tokenPath,
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
  });

  const gmail = google.gmail({ version: "v1", auth });

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: params.query,
    maxResults: params.maxResults ?? 50,
  });

  const messages = listRes.data.messages ?? [];
  const out: GmailMessageSummary[] = [];

  for (const m of messages) {
    if (!m.id) continue;
    const getRes = await gmail.users.messages.get({
      userId: "me",
      id: m.id,
      format: "metadata",
      metadataHeaders: ["From", "To", "Subject", "Date"],
    });

    const msg = getRes.data;
    out.push(summarizeMessage(msg));
  }

  return out;
}

export async function getMessageSnippet(params: {
  credentialsPath: string;
  tokenPath: string;
  id: string;
}): Promise<string> {
  const auth = await getOAuthClient({
    credentialsPath: params.credentialsPath,
    tokenPath: params.tokenPath,
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
  });

  const gmail = google.gmail({ version: "v1", auth });

  const getRes = await gmail.users.messages.get({
    userId: "me",
    id: params.id,
    format: "full",
  });

  return getRes.data.snippet ?? "";
}

export async function getMessageBodyText(params: {
  credentialsPath: string;
  tokenPath: string;
  id: string;
}): Promise<string> {
  const auth = await getOAuthClient({
    credentialsPath: params.credentialsPath,
    tokenPath: params.tokenPath,
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
  });

  const gmail = google.gmail({ version: "v1", auth });

  const getRes = await gmail.users.messages.get({
    userId: "me",
    id: params.id,
    format: "full",
  });

  const payload = getRes.data.payload;
  const text = extractBestBodyText(payload);
  return text;
}

function extractBestBodyText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";

  const parts: gmail_v1.Schema$MessagePart[] = [];
  collectParts(payload, parts);

  const plain = parts.find((p) => (p.mimeType ?? "").toLowerCase() === "text/plain");
  if (plain) return decodeBody(plain.body?.data);

  const html = parts.find((p) => (p.mimeType ?? "").toLowerCase() === "text/html");
  if (html) return stripHtml(decodeBody(html.body?.data));

  return decodeBody(payload.body?.data);
}

function collectParts(part: gmail_v1.Schema$MessagePart, out: gmail_v1.Schema$MessagePart[]) {
  out.push(part);
  const sub = part.parts ?? [];
  for (const p of sub) collectParts(p, out);
}

function decodeBody(data: string | null | undefined): string {
  if (!data) return "";
  // Gmail uses base64url.
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const buf = Buffer.from(b64 + pad, "base64");
  return buf.toString("utf8");
}

function stripHtml(html: string): string {
  // Very lightweight for our heuristics.
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getThread(params: {
  credentialsPath: string;
  tokenPath: string;
  threadId: string;
}): Promise<GmailThreadMessage[]> {
  const auth = await getOAuthClient({
    credentialsPath: params.credentialsPath,
    tokenPath: params.tokenPath,
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
  });

  const gmail = google.gmail({ version: "v1", auth });

  const res = await gmail.users.threads.get({
    userId: "me",
    id: params.threadId,
    format: "metadata",
    metadataHeaders: ["From", "To", "Subject", "Date"],
  });

  const messages = res.data.messages ?? [];
  return messages
    .filter((m): m is gmail_v1.Schema$Message & { id: string; threadId: string } => Boolean(m.id && m.threadId))
    .map((m) => {
      const headers = m.payload?.headers ?? [];
      const internalDateMs = m.internalDate ? Number(m.internalDate) : undefined;
      return {
        id: m.id,
        threadId: m.threadId,
        internalDateMs: Number.isFinite(internalDateMs) ? internalDateMs : undefined,
        from: headerValue(headers, "From"),
        to: headerValue(headers, "To"),
        subject: headerValue(headers, "Subject"),
        labels: m.labelIds ?? undefined,
      } satisfies GmailThreadMessage;
    });
}

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const h = headers.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? undefined;
}

function summarizeMessage(msg: gmail_v1.Schema$Message): GmailMessageSummary {
  const headers = msg.payload?.headers ?? [];
  const from = headerValue(headers, "From");
  const to = headerValue(headers, "To");
  const subject = headerValue(headers, "Subject");

  const internalDateMs = msg.internalDate ? Number(msg.internalDate) : undefined;

  return {
    id: msg.id ?? "",
    threadId: msg.threadId ?? undefined,
    internalDateMs: Number.isFinite(internalDateMs) ? internalDateMs : undefined,
    from,
    to,
    subject,
    snippet: msg.snippet ?? undefined,
    labels: msg.labelIds ?? undefined,
    permalink: msg.id ? `https://mail.google.com/mail/u/0/#inbox/${msg.id}` : undefined,
  };
}
