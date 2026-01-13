# Commute Monitor Skill

Smart commute tracking with real-time traffic alerts, countdown messages, and automatic daily scheduling.

## What It Does

- **Morning check (7:30 AM)** — Scans today's calendar, finds meetings with locations
- **Calculates departure times** — Uses Google Maps real traffic data for your commute
- **Sends alerts** — "You need to leave at 8:22 AM for your 10:00 AM meeting"
- **Real-time monitoring** — Checks every 60 seconds, sends countdown: "leave in 15", "leave in 10", etc.
- **Traffic alerts** — "Traffic changed! You need to leave 5 min earlier now"

## First-Time Setup (After Reinstall)

### 1. Store Your Locations
Create `/root/.clawdbot/config/personal-locations.json`:

```json
{
  "home": {
    "address": "Your Home Address",
    "coordinates": {
      "lat": 0.0000,
      "lng": 0.0000
    }
  },
  "daycare": {
    "address": "Daycare Address (optional)",
    "coordinates": {
      "lat": 0.0000,
      "lng": 0.0000
    }
  },
  "commute_preferences": {
    "buffer_minutes": 10
  }
}
```

**Get coordinates:**
- Google Maps: Right-click location → Copy coordinates
- Or use: https://www.gpscoordinates.net/

### 2. Add Google Maps API Key

Get your API key from Google Cloud Console, then save it:

```bash
echo "YOUR_API_KEY_HERE" > ~/.clawdbot/credentials/google-maps-api.txt
chmod 600 ~/.clawdbot/credentials/google-maps-api.txt
```

### 3. Enable Google Calendar

Your calendar must be already synced via `/root/clawd/tools/google-calendar/`.

## Usage

### Calculate Departure Time
```bash
bun /root/clawd/skills/joelmale-commute/cli.ts calculate 10:00
bun /root/clawd/skills/joelmale-commute/cli.ts calculate 10:00 "Meeting Location Address"
```

### Manual Morning Check
```bash
bun /root/clawd/skills/joelmale-commute/cli.ts morning-check
```

### Start Monitoring (Manual)
```bash
bun /root/clawd/skills/joelmale-commute/cli.ts monitor 10:00
```

### Monitor with Custom Interval
```bash
bun /root/clawd/skills/joelmale-commute/cli.ts monitor 10:00 30000
# Check every 30 seconds instead of default 60
```

## Automatic Scheduling

Two cron jobs run automatically (via Clawdbot):

**Morning Check (7:30 AM, weekdays)**
- Scans today's calendar
- Finds meetings with locations
- Calculates departure times
- Sends Telegram alerts

**Monitoring (During commute)**
- Starts 60 seconds after morning check
- Tracks real-time traffic
- Sends countdown messages

## Output Examples

### Morning Alert
```
🚗 You have to leave at 8:22 AM for your 10:00 AM meeting at Arundel
```

### Departure Time Calculation
```
📍 Calculating commute...

🏠 → 🏫 27 mins (24.6 km)
🏫 → 📍 41 mins (41.9 km)

⏱️  Total commute: 26 min (drive) + 15 min (daycare drop-off) + 40 min (to meeting)

📍 You'll arrive by: 9:45:00 AM (15 min before meeting)

🚗 Leave home at: 8:22:18 AM
```

### Live Monitoring (Telegram)
```
🚗 Hey Joel, you have to leave in 15 min
🚗 Hey Joel, you have to leave in 10 min
⚠️ Traffic alert! You need to leave 5 min earlier now: 8:27 AM
🚗 Hey Joel, you have to leave in 5 min
🚗 GO! It's time to leave NOW!
```

## Files Included

- `cli.ts` — Entry point
- `commute-time.ts` — Calculates departure time using Google Maps
- `commute-monitor.ts` — Monitors traffic, sends alerts
- `morning-commute-check.ts` — Calendar integration, morning alerts
- `SKILL.md` — This file

## Troubleshooting

### "Could not geocode address"
- Make sure your addresses are complete and accurate
- Use Google Maps to verify the exact address
- Coordinates are more reliable than text addresses

### "Maps API error: Billing not enabled"
- Enable billing on your Google Cloud project
- https://console.cloud.google.com/project/_/billing/enable
- Wait 5 minutes for it to propagate

### "No meetings with locations found"
- Make sure your calendar events have location details
- Edit the event in Google Calendar, add location, save
- Try the manual command: `bun cli.ts morning-check`

### No Telegram messages
- Verify Clawdbot can send Telegram messages (check other alerts work)
- Make sure your Telegram user ID is correct in cron config
- Check that your calendar has events with locations today

## Future Enhancements

- [ ] Support multiple daily routes (with kids vs direct)
- [ ] HomeKit/Apple Home integration (pre-warm car)
- [ ] SMS fallback if Telegram fails
- [ ] Different buffer times for different road types
- [ ] Historical traffic analysis (learn optimal times)

## Recovery After Reinstall

If you reinstall Clawdbot:

1. Restore `/root/.clawdbot/config/personal-locations.json` (keep backup!)
2. Restore `/root/.clawdbot/credentials/google-maps-api.txt` (keep backup!)
3. Cron jobs are managed by Clawdbot (will be recreated)
4. Everything else is self-contained in this skill ✅
