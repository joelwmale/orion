#!/bin/bash
# Auto-commit changes to skills/tools to GitHub
# Run periodically via cron

cd /root/clawd || exit 1

# Check if there are uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S UTC')
  
  git add -A
  git commit -m "Auto-commit: Changes to skills/tools at $TIMESTAMP" || true
  
  # Push to origin
  git push origin master -q || echo "Push failed (network issue?)"
fi
