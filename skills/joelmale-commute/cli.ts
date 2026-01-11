#!/usr/bin/env bun

/**
 * Commute Monitor Skill CLI
 * 
 * Usage:
 *   bun cli.ts calculate <HH:MM> [address]
 *   bun cli.ts monitor <HH:MM> [interval-ms]
 */

const command = process.argv[2];
const args = process.argv.slice(3);

if (command === 'calculate') {
  // Run commute-time calculation
  const proc = Bun.spawn(['bun', '/root/clawd/tools/commute-time.ts', 'calculate', ...args]);
  await proc.exited;
} else if (command === 'monitor') {
  // Run commute monitor
  const proc = Bun.spawn(['bun', '/root/clawd/tools/commute-monitor.ts', 'monitor', ...args]);
  await proc.exited;
} else {
  console.error('Usage:');
  console.error('  bun cli.ts calculate <HH:MM> [address]');
  console.error('  bun cli.ts monitor <HH:MM> [interval-ms]');
  console.error('');
  console.error('Examples:');
  console.error('  bun cli.ts calculate 10:00');
  console.error('  bun cli.ts calculate 10:00 "3/9 Technology Dr, Arundel"');
  console.error('  bun cli.ts monitor 10:00');
  console.error('  bun cli.ts monitor 10:00 30000');
}
