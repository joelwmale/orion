import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

interface MeetingWithLocation {
  title: string;
  time: string;
  location: string;
  isoTime: string; // For cron setup
}

async function getTomorrowsMeetings(): Promise<MeetingWithLocation[]> {
  return new Promise((resolve) => {
    const proc = spawn("bun", ["/root/clawd/tools/google-calendar/cli.ts", "upcoming"]);

    let output = "";

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", () => {
      const meetings: MeetingWithLocation[] = [];

      // Parse calendar output
      // Format: "2026-01-12T10:00:00+10:00 - 2026-01-12T13:00:00+10:00 | Pixel x Oz Window Films @ 3/9 Technology Dr"
      const lines = output.split("\n");
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDate = tomorrow.toISOString().split("T")[0];

      for (const line of lines) {
        if (line.includes("@") && line.includes(tomorrowDate)) {
          const timeMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
          const titleMatch = line.match(/\| ([^@]+) @/);
          const locationMatch = line.match(/@ (.+)$/);

          if (timeMatch && titleMatch && locationMatch) {
            const isoTime = timeMatch[0];
            const title = titleMatch[1].trim();
            const location = locationMatch[1].trim();
            const timeObj = new Date(isoTime);
            const timeStr = timeObj.toLocaleTimeString("en-AU", {
              hour: "2-digit",
              minute: "2-digit",
            });

            meetings.push({
              title,
              time: timeStr,
              location,
              isoTime,
            });
          }
        }
      }

      resolve(meetings);
    });

    proc.on("error", () => {
      resolve([]);
    });
  });
}

async function main() {
  const meetings = await getTomorrowsMeetings();

  if (meetings.length === 0) {
    console.log("✅ No meetings with locations tomorrow.");
    return;
  }

  console.log(`📅 Found ${meetings.length} meeting(s) tomorrow with locations:\n`);

  for (let i = 0; i < meetings.length; i++) {
    const m = meetings[i];
    console.log(`${i + 1}. ${m.title} at ${m.time}`);
    console.log(`   📍 ${m.location}\n`);
  }

  // Save meetings for confirmation handling
  const configPath = join(homedir(), ".clawdbot", "config", "tomorrow-meetings.json");
  writeFileSync(configPath, JSON.stringify(meetings, null, 2));

  // Ask user for confirmation
  console.log(`Reply with the meeting number(s) you want alerts for (e.g., "1,2" or just "1")`);
  console.log(`Or reply "no" to skip monitoring.\n`);

  // This would integrate with Telegram in real usage
  // For now, just log the request
}

main();
