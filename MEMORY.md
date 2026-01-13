# MEMORY.md - Long-Term Learnings

## Preferences & Patterns

### Heartbeat Schedule
**Jan 12, 2026:** Joel asked to stop hourly heartbeat messages. Changed to **every 6 hours**. Lesson: Don't send HEARTBEAT_OK every hour — it's noise. Only ping if something actually needs attention, or adjust to a less frequent schedule.

### Timezone Rules
**Jan 13, 2026:** I kept getting Joel's timezone wrong (saying it was "evening" at 23:00 UTC when it was actually 9 AM in Brisbane). Created CLOCKS.md with explicit rules. **Always assume Brisbane time (UTC+10). Never mention UTC unless comparing.**

### Commute Monitor Lesson
**Jan 13, 2026 (05:15):** Fixed commute monitor generating false alerts. Two bugs:
1. **Timezone calculation:** Was manually adding 10 hours to UTC instead of using `Intl.DateTimeFormat` with `Australia/Brisbane`. This caused date drift and catching tomorrow's events.
2. **Remote meeting filter:** Wasn't filtering out Google Meet, Teams, Zoom, etc. These are remote — no commute needed.
**Lesson:** When dealing with calendar events and timezones, use proper Intl APIs. When filtering meetings, always exclude remote-only locations (video conference URLs/services). Test against actual calendar data, not just assumptions.

## Key Decisions

*To be filled in as patterns emerge.*
