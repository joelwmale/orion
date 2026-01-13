#!/usr/bin/env bun

/**
 * Morning Commute Check
 * Runs at 7:30 AM
 * Checks today's calendar for all meetings with locations
 * Tells Joel when to leave for each one
 */

import { spawn } from "node:child_process";

interface CalendarEvent {
  title: string;
  startTime: string;
  startISO: string;
  location: string;
  endTime: string;
}

async function getTodaysMeetings(): Promise<CalendarEvent[]> {
  return new Promise((resolve) => {
    const proc = spawn("bun", ["/root/clawd/tools/google-calendar/cli.ts", "upcoming"]);  // Uses tools directory

    let output = "";

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", () => {
      const meetings: CalendarEvent[] = [];
      // Get today's date in Brisbane timezone
      const formatter = new Intl.DateTimeFormat("en-AU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Australia/Brisbane",
      });
      const parts = formatter.formatToParts(new Date());
      const yearPart = parts.find((p) => p.type === "year")?.value;
      const monthPart = parts.find((p) => p.type === "month")?.value;
      const dayPart = parts.find((p) => p.type === "day")?.value;
      const todayDate = `${yearPart}-${monthPart}-${dayPart}`;

      // Remote meeting location keywords to filter out
      const remoteKeywords = [
        "google meet",
        "teams",
        "zoom",
        "microsoft teams",
        "jitsi",
        "discord",
      ];

      // Parse calendar output (location may span multiple lines)
      const lines = output.split("\n");
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];

        // Look for lines with @ (location indicator) and today's date
        if (line.includes("@") && line.includes(todayDate)) {
          // Format: "2026-01-12T10:00:00+10:00 - 2026-01-12T13:00:00+10:00 | Title @ Location"
          const timeMatch = line.match(
            /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})[^|]*\| ([^@]+) @ (.+)$/
          );

          if (timeMatch) {
            const isoStart = timeMatch[1];
            const title = timeMatch[2].trim();
            let location = timeMatch[3].trim();

            // Check if location continues on next line(s)
            if (i + 1 < lines.length) {
              const nextLine = lines[i + 1];
              // If next line doesn't start with a time and doesn't have @, it's location continuation
              if (
                !nextLine.includes("@") &&
                !nextLine.match(/^\d{4}-\d{2}-\d{2}/)
              ) {
                location = location + " " + nextLine.trim();
                i++; // Skip the next line
              }
            }

            // Skip remote meetings (Google Meet, Teams, Zoom, etc.)
            const isRemote = remoteKeywords.some((keyword) =>
              location.toLowerCase().includes(keyword)
            );

            if (!isRemote) {
              const startObj = new Date(isoStart);
              const startTime = startObj.toLocaleTimeString("en-AU", {
                hour: "2-digit",
                minute: "2-digit",
              });

              meetings.push({
                title,
                startTime,
                startISO: isoStart,
                location,
                endTime: "", // We'll calculate if needed
              });
            }
          }
        }
        i++;
      }

      // Sort by time
      meetings.sort(
        (a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime()
      );

      resolve(meetings);
    });

    proc.on("error", () => {
      resolve([]);
    });
  });
}

async function getDepartureTime(meetingTime: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn("bun", [
      "/root/clawd/skills/joelmale-commute/commute-time.ts",
      "calculate",
      meetingTime,
    ]);

    let output = "";

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        const match = output.match(/Leave home at: (\d{1,2}:\d{2}(?::\d{2})?)/);
        if (match) {
          // Remove seconds if present
          const time = match[1].split(":").slice(0, 2).join(":");
          resolve(time);
        } else {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
}

async function sendTelegramMessage(message: string): Promise<void> {
  // This would integrate with Telegram API in real setup
  console.log(`📱 [Telegram] ${message}`);
}

async function main() {
  console.log("🌅 Checking today's meetings with locations...\n");

  const meetings = await getTodaysMeetings();

  if (meetings.length === 0) {
    console.log("✅ No meetings with locations today.\n");
    return;
  }

  console.log(`Found ${meetings.length} meeting(s) with locations:\n`);

  for (const meeting of meetings) {
    // Parse the ISO timestamp to extract date and time
    // Format: "2026-01-12T10:00:00+10:00"
    const isoMatch = meeting.startISO.match(/(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):/);
    
    if (!isoMatch) {
      console.log(`⚠️  Couldn't parse time from: ${meeting.startISO}`);
      continue;
    }

    const [, meetingDate, hours, minutes] = isoMatch;
    const meetingTimeStr = `${meetingDate} ${hours}:${minutes}`;
    
    const departureTime = await getDepartureTime(meetingTimeStr);

    if (departureTime) {
      const message = `🚗 You have to leave at ${departureTime} for your ${meeting.startTime} meeting at ${meeting.location}`;
      console.log(message);
      await sendTelegramMessage(message);
    } else {
      console.log(`⚠️  Couldn't calculate commute for: ${meeting.title}`);
    }

    // Small delay between API calls
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("\n✅ All departure times calculated. Monitoring will start at 7:30 AM.\n");
}

main();
