import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { getOAuthClient } from "./googleAuth";

export interface ListEventsParams {
  credentialsPath: string;
  tokenPath: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
  maxResults?: number;
}

export async function listEvents(params: ListEventsParams): Promise<calendar_v3.Schema$Event[]> {
  const auth = await getOAuthClient({
    credentialsPath: params.credentialsPath,
    tokenPath: params.tokenPath,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  });

  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.events.list({
    calendarId: params.calendarId,
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: params.maxResults ?? 50,
  });

  return res.data.items ?? [];
}

export function formatEvent(e: calendar_v3.Schema$Event) {
  const start = e.start?.dateTime ?? e.start?.date ?? "";
  const end = e.end?.dateTime ?? e.end?.date ?? "";
  const summary = e.summary ?? "(no title)";
  const location = e.location ? ` @ ${e.location}` : "";
  return `${start} - ${end} | ${summary}${location}`;
}
