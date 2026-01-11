# Orion Workflow

## Auto-Save & Backup

**Automatic (every 30 minutes):**
- Any changes to `/root/clawd/skills/`, `/root/clawd/tools/`, `memory/`, or root config files
- Automatically committed and pushed to GitHub
- No action needed from me

**Scheduled (external):**
- **Weekly updates:** Monday 2am AEST — pulls latest clawdbot framework, installs deps, restarts if needed
- **Daily summary:** Monday-Friday 8am AEST — runs `orion:today`, sends to Telegram

## Manual Workflow (When Building Features)

1. **Create skill/tool** in `/root/clawd/skills/` or `/root/clawd/tools/`
2. **Test it:** `bun run <command>`
3. **Auto-commit runs in background** (within 30 min)
4. **Done.** Changes are on GitHub.

## Memory Management

- **Daily:** `memory/YYYY-MM-DD.md` captures raw logs (auto-backed-up)
- **Periodic:** Update `MEMORY.md` with curated insights
- **Both:** Auto-committed every 30 minutes

## Config Files Tracked

- `.env` ❌ (secrets, never track)
- `SOUL.md`, `IDENTITY.md`, `USER.md` ✅
- `MEMORY.md`, `memory/` ✅
- `HEARTBEAT.md` ✅
- `TOOLS.md` ✅
- `skills/` ✅
- `tools/` ✅
- `scripts/` ✅

## Recovery

If something breaks:
```bash
cd /root/clawd
git log --oneline          # See all commits
git show <commit-hash>     # See what changed
git revert <commit-hash>   # Undo a bad change
```

Everything is backed up on GitHub with full history.
