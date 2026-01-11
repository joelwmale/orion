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
    const proc = spawn("bun", ["/root/clawd/tools/google-calendar/cli.ts", "upcoming"]);

    let output = "";

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", () => {
      const meetings: CalendarEvent[] = [];
      const today = new Date();
      const todayDate = today.toISOString().split("T")[0];

      // Parse calendar output
      const lines = output.split("\n");

      for (const line of lines) {
        // Look for lines with @ (location indicator) and today's date
        if (line.includes("@") && line.includes(todayDate)) {
          // Format: "2026-01-12T10:00:00+10:00 - 2026-01-12T13:00:00+10:00 | Title @ Location"
          const timeMatch = line.match(
            /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})[^|]*\| ([^@]+) @ (.+)$/
          );

          if (timeMatch) {
            const isoStart = timeMatch[1];
            const title = timeMatch[2].trim();
            const location = timeMatch[3].trim();

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
      "/root/clawd/tools/commute-time.ts",
      "calculate",
      meetingTime,
    ]);

    let output = "";

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        const match = output.match(/Leave home at: (\d{1,2}:\d{2})/);
        if (match) {
          resolve(match[1]);
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
    // Calculate departure time
    const meetingTime = meeting.startTime;
    const departureTime = await getDepartureTime(meetingTime);

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
