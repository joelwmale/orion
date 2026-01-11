import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

interface MonitorState {
  lastDepartureTime: string | null;
  lastNotifiedCountdowns: number[];
  initialized: boolean;
}

function getStateFile(): string {
  return join(homedir(), ".clawdbot", "cache", "commute-monitor-state.json");
}

function loadState(): MonitorState {
  const path = getStateFile();
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, "utf8"));
  }
  return {
    lastDepartureTime: null,
    lastNotifiedCountdowns: [],
    initialized: false,
  };
}

function saveState(state: MonitorState): void {
  const path = getStateFile();
  const dir = join(homedir(), ".clawdbot", "cache");
  if (!existsSync(dir)) {
    throw new Error(`Cache directory not found: ${dir}`);
  }
  writeFileSync(path, JSON.stringify(state, null, 2));
}

async function getCurrentDepartureTime(meetingTime: string): Promise<string | null> {
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
        // Extract "Leave home at: HH:MM:SS"
        const match = output.match(/Leave home at: (\d{1,2}:\d{2}:\d{2})/);
        if (match) {
          resolve(match[1]);
        } else {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });

    proc.on("error", () => {
      resolve(null);
    });
  });
}

async function sendTelegramMessage(message: string): Promise<void> {
  console.log(`📨 [Telegram] ${message}`);
  // In real implementation, would call Telegram API
  // For now, just logging
}

function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

async function monitorCommute(meetingTime: string, checkIntervalMs: number = 60000) {
  const state = loadState();
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Start time: 7:30 AM
  const monitorStartMinutes = 7 * 60 + 30;

  // Get current meeting time
  const meetingMinutes = timeToMinutes(meetingTime);

  // If we're not in the monitoring window, skip
  if (currentMinutes < monitorStartMinutes || currentMinutes > meetingMinutes) {
    return;
  }

  // Get current estimated departure time
  const currentDeparture = await getCurrentDepartureTime(meetingTime);
  if (!currentDeparture) {
    return;
  }

  const currentDepartureMinutes = timeToMinutes(currentDeparture);

  // Check if departure time has changed significantly (more than 2 minutes)
  if (state.lastDepartureTime) {
    const lastDepartureMinutes = timeToMinutes(state.lastDepartureTime);
    const diff = Math.abs(currentDepartureMinutes - lastDepartureMinutes);

    if (diff > 2) {
      if (lastDepartureMinutes < currentDepartureMinutes) {
        await sendTelegramMessage(
          `⚠️ Traffic alert! You need to leave ${diff} min later now: ${currentDeparture}`
        );
      } else {
        await sendTelegramMessage(
          `✅ Traffic cleared! You can leave ${diff} min earlier: ${currentDeparture}`
        );
      }

      // Reset countdown notifications
      state.lastNotifiedCountdowns = [];
    }
  }

  state.lastDepartureTime = currentDeparture;

  // Send countdown messages
  const minutesUntilLeave = currentDepartureMinutes - currentMinutes;

  const countdownThresholds = [15, 10, 5, 2];
  for (const threshold of countdownThresholds) {
    if (
      minutesUntilLeave <= threshold &&
      !state.lastNotifiedCountdowns.includes(threshold)
    ) {
      await sendTelegramMessage(`🚗 Hey Joel, you have to leave in ${threshold} min`);
      state.lastNotifiedCountdowns.push(threshold);
    }
  }

  // If it's time to leave NOW
  if (minutesUntilLeave <= 0 && !state.lastNotifiedCountdowns.includes(0)) {
    await sendTelegramMessage(`🚗 GO! It's time to leave NOW!`);
    state.lastNotifiedCountdowns.push(0);
  }

  saveState(state);
}

// Main
const args = process.argv.slice(2);
if (args[0] === "monitor" && args[1]) {
  const meetingTime = args[1]; // Format: HH:MM
  const checkInterval = parseInt(args[2]) || 60000; // Default 60 seconds

  console.log(`🔍 Monitoring commute for ${meetingTime} meeting...`);
  console.log(`📍 Checking every ${checkInterval / 1000} seconds\n`);

  // Run once immediately
  monitorCommute(meetingTime, checkInterval);

  // Then run periodically
  setInterval(() => {
    monitorCommute(meetingTime, checkInterval);
  }, checkInterval);
} else {
  console.error("Usage: commute-monitor monitor HH:MM [interval-ms]");
  console.error("Example: commute-monitor monitor 10:00 60000");
}
