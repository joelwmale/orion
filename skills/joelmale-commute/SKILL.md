# Commute Monitor Skill

Smart commute tracking with real-time traffic alerts, countdown messages, and automatic scheduling.

## Features

- **Real-time traffic monitoring** — Checks every 60 seconds from 7:30 AM until departure time
- **Traffic alerts** — Warns if traffic adds/removes >2 minutes from departure time
- **Countdown messages** — "hey Joel, leave in 15", "leave in 10", "leave in 5", "GO NOW!"
- **Automatic scheduling** — Cron job starts monitoring at 7:30 AM weekdays
- **Google Maps integration** — Uses real traffic data accounting for time of day
- **Location awareness** — Calculates commute from home → daycare → meeting location

## Setup

### 1. Store locations
Edit `/root/.clawdbot/config/personal-locations.json`:

```json
{
  "home": {
    "address": "14 Hexham St, Yarrabilba Queensland 4207, Australia",
    "coordinates": {
      "lat": -27.8658,
      "lng": 153.0892
    }
  },
  "daycare": {
    "address": "17-25 Park Ridge Rd, Park Ridge QLD 4125",
    "coordinates": {
      "lat": -27.7456,
      "lng": 152.9578
    }
  },
  "commute_preferences": {
    "buffer_minutes": 10
  }
}
```

### 2. Google Maps API key
Store at `~/.clawdbot/credentials/google-maps-api.txt`

## Usage

### Calculate single departure time
```bash
bun /root/clawd/skills/joelmale-commute/cli.ts calculate 10:00
bun /root/clawd/skills/joelmale-commute/cli.ts calculate 10:00 "3/9 Technology Dr, Arundel"
```

### Start monitoring (one-off)
```bash
bun /root/clawd/skills/joelmale-commute/cli.ts monitor 10:00
# Checks every 60 seconds, sends alerts/countdowns
```

### Start monitoring with custom interval
```bash
bun /root/clawd/skills/joelmale-commute/cli.ts monitor 10:00 30000
# Check every 30 seconds instead of 60
```

## Auto-Scheduling (Cron)

A cron job runs automatically at 7:30 AM weekdays (configured separately).

To update the meeting time in the cron job, edit the cron payload:

```
bun /root/clawd/skills/joelmale-commute/cli.ts monitor 10:00 60000
```

Change `10:00` to your meeting time.

## Output

**Calculate:**
```
📍 Calculating commute...

🏠 → 🏫 27 mins (24.6 km)
🏫 → 📍 41 mins (41.9 km)

⏱️  Total commute: 26 min (drive) + 15 min (daycare drop-off) + 40 min (to meeting)

📍 You'll arrive by: 9:45:00 AM (15 min before meeting)

🚗 Leave home at: 8:22:18 AM
```

**Monitor (Telegram messages):**
```
🚗 Hey Joel, you have to leave in 15 min
🚗 Hey Joel, you have to leave in 10 min
⚠️ Traffic alert! You need to leave 5 min later now: 8:27 AM
🚗 Hey Joel, you have to leave in 5 min
🚗 GO! It's time to leave NOW!
```

## Future Enhancements

- [ ] Auto-detect meeting time from calendar
- [ ] Support multiple meetings per day
- [ ] Different commute routes (direct vs with kids)
- [ ] Integrate with car's start time / HomeKit
- [ ] SMS fallback if Telegram fails
