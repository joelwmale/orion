# CLOCKS.md - Your Timezone Rules

## Core Rule
**Always assume Brisbane time (Australia/Brisbane = UTC+10, no DST)**

When you state a time, it's Brisbane time. Never mention UTC unless explicitly comparing.

## Quick Reference
- **Current timezone:** UTC+10 (Australia/Brisbane)
- **Your local time RN:** Check the timestamp in messages
- **When you wake up:** 7:30 AM Brisbane
- **Your work hours:** 8:30 AM – 5:00 PM Brisbane
- **When to stop bugging you:** After 7 PM Brisbane

## Conversion (How Not to Mess It Up)

### ❌ What I Was Doing Wrong
Message timestamp: `2026-01-12T23:00Z` (that's 23:00 UTC)
I thought: "23:00 UTC → evening, Joel is probably winding down"
**WRONG.** That's 9:00 AM the next day in Brisbane.

### ✅ How to Do It Right
1. See timestamp: `2026-01-12T23:00Z`
2. Add 10 hours: 23:00 + 10 = 33 → wrap to next day, 9:00
3. Think: "9:00 AM Brisbane = morning work time"

**Formula:** UTC time + 10 hours = Brisbane time (add 1 day if result > 24)

## Examples
- UTC 06:00 → Brisbane 16:00 (4 PM)
- UTC 22:00 → Brisbane 08:00 next day (8 AM)
- UTC 14:00 → Brisbane 00:00 next day (midnight)
- UTC 10:00 → Brisbane 20:00 (8 PM)

## When to Mention Time

✅ **DO mention:**
- "It's 9 AM, you're at work"
- "It's 7 PM, wind down time"
- "Check in at 8:30 AM when Joel starts"

❌ **DON'T say:**
- "It's 23:00 UTC"
- "Evening (based on UTC)"
- "Let me convert UTC to your time..."

Just state Brisbane time directly. That IS your time.

## Daily Routine (for context)
- 7:30 AM – Wake up / morning routine
- 8:30 AM – Work starts
- 10:00 AM – 12:00 PM – Focus time (don't bug)
- 12:00 PM – 1:00 PM – Lunch / break
- 1:00 PM – 5:00 PM – Work
- 5:00 PM – Commute ends / evening
- 7:00 PM – Wind down time (don't send work stuff)
- 11:00 PM – Usually asleep

## Heartbeat Timing
- 6 hourly checks = roughly 1:30 AM, 7:30 AM, 1:30 PM, 7:30 PM, 1:30 AM...
- During work hours (8:30 AM – 5:00 PM): More relevant to mention
- Late evening (7 PM+) or early morning (<7:30 AM): Less relevant to bug Joel
