#!/usr/bin/env bun

/**
 * Commute Monitor Skill CLI
 * 
 * Usage:
 *   bun cli.ts calculate <HH:MM> [address]
 *   bun cli.ts monitor <HH:MM> [interval-ms]
 *   bun cli.ts morning-check
 */

const SKILL_DIR = "/root/clawd/skills/joelmale-commute";
const command = process.argv[2];
const args = process.argv.slice(3);

if (command === "calculate") {
  // Run commute-time calculation
  const proc = Bun.spawn(["bun", `${SKILL_DIR}/commute-time.ts`, "calculate", ...args]);
  await proc.exited;
} else if (command === "monitor") {
  // Run commute monitor
  const proc = Bun.spawn(["bun", `${SKILL_DIR}/commute-monitor.ts`, "monitor", ...args]);
  await proc.exited;
} else if (command === "morning-check") {
  // Run morning commute check (calendar integration)
  const proc = Bun.spawn(["bun", `${SKILL_DIR}/morning-commute-check.ts`]);
  await proc.exited;
} else {
  console.error("Usage:");
  console.error("  bun cli.ts calculate <HH:MM> [address]");
  console.error("  bun cli.ts monitor <HH:MM> [interval-ms]");
  console.error("  bun cli.ts morning-check");
  console.error("");
  console.error("Examples:");
  console.error("  bun cli.ts calculate 10:00");
  console.error(
    '  bun cli.ts calculate 10:00 "3/9 Technology Dr, Arundel"'
  );
  console.error("  bun cli.ts monitor 10:00");
  console.error("  bun cli.ts monitor 10:00 30000");
  console.error("  bun cli.ts morning-check");
}
