# Google Calendar (Orion)

This folder lets Orion read your Google Calendar events for **personal** + **work** profiles.

## 1) Create Google OAuth credentials

You’ll do this once in Google Cloud Console:

1. Create (or pick) a project
2. Enable **Google Calendar API**
3. Create credentials → **OAuth client ID** → **Web application**
4. Add an **Authorized redirect URI**:
   - `http://localhost:3000/oauth2callback`
5. Download the JSON file
6. Save it at:
   - `secrets/google/credentials.json`

Notes:
- This setup uses a localhost redirect so you can authorize in your browser.
- Tokens are stored locally in `secrets/google/`.

## 2) Link each profile (personal + work)

Run these from the repo root:

- Personal:
  - `bun run calendar:init -- --profile personal`
- Work:
  - `bun run calendar:init -- --profile work`

The command prints an authorization URL; open it, approve access, and Orion will save a token.

## 3) List upcoming events

- Both:
  - `bun run calendar:upcoming -- --profile all --days 7`
- Just one:
  - `bun run calendar:upcoming -- --profile personal --days 1`

## Config

Edit `config/calendars.json` if needed:
- `calendarId`: keep `primary` unless you want a specific calendar.
- `tokenPath`: separate token files for each Google account.
