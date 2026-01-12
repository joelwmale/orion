# MEMORY.md - Long-Term Learnings

## Preferences & Patterns

### Heartbeat Schedule
**Jan 12, 2026:** Joel asked to stop hourly heartbeat messages. Changed to **every 6 hours**. Lesson: Don't send HEARTBEAT_OK every hour — it's noise. Only ping if something actually needs attention, or adjust to a less frequent schedule.

### Timezone Rules
**Jan 13, 2026:** I kept getting Joel's timezone wrong (saying it was "evening" at 23:00 UTC when it was actually 9 AM in Brisbane). Created CLOCKS.md with explicit rules. **Always assume Brisbane time (UTC+10). Never mention UTC unless comparing.**

## Key Decisions

*To be filled in as patterns emerge.*
