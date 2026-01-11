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

export interface CreateEventParams {
  credentialsPath: string;
  tokenPath: string;
  calendarId: string;
  summary: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
  attendees?: string[];
  description?: string;
  location?: string;
}

export async function createEvent(params: CreateEventParams & { forceReauth?: boolean }): Promise<calendar_v3.Schema$Event> {
  const auth = await getOAuthClient({
    credentialsPath: params.credentialsPath,
    tokenPath: params.tokenPath,
    scopes: ["https://www.googleapis.com/auth/calendar"],
    forceReauth: params.forceReauth,
  });

  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.events.insert({
    calendarId: params.calendarId,
    sendUpdates: "all",
    requestBody: {
      summary: params.summary,
      description: params.description,
      location: params.location,
      start: {
        dateTime: params.startDateTime,
        timeZone: params.timeZone,
      },
      end: {
        dateTime: params.endDateTime,
        timeZone: params.timeZone,
      },
      attendees: params.attendees?.map((email) => ({ email })) ?? undefined,
    },
  });

  if (!res.data) throw new Error("Failed to create event (no data returned)");
  return res.data;
}

export async function updateEvent(params: {
  credentialsPath: string;
  tokenPath: string;
  calendarId: string;
  eventId: string;
  summary?: string;
  startDateTime?: string;
  endDateTime?: string;
  timeZone?: string;
  attendees?: string[];
  description?: string;
  location?: string;
}): Promise<calendar_v3.Schema$Event> {
  const auth = await getOAuthClient({
    credentialsPath: params.credentialsPath,
    tokenPath: params.tokenPath,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.events.patch({
    calendarId: params.calendarId,
    eventId: params.eventId,
    sendUpdates: "all",
    requestBody: {
      summary: params.summary,
      description: params.description,
      location: params.location,
      start: params.startDateTime
        ? {
            dateTime: params.startDateTime,
            timeZone: params.timeZone,
          }
        : undefined,
      end: params.endDateTime
        ? {
            dateTime: params.endDateTime,
            timeZone: params.timeZone,
          }
        : undefined,
      attendees: params.attendees?.map((email) => ({ email })) ?? undefined,
    },
  });

  if (!res.data) throw new Error("Failed to update event (no data returned)");
  return res.data;
}
