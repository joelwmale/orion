# How I Updated 10 Laravel Projects for 12.x Without Nuking Our Clients' Revenue

When Laravel 12.x dropped, I had 10 active client projects at Pixel still on older versions. Two of them were especially terrifying:

**Nourishd** — a food delivery subscription platform. If the upgrade breaks payments, they lose revenue in real time.

**Canary** — a medicinal cannabis prescription platform. This one handles controlled drugs in Australia. Regulatory compliance + data integrity = zero room for error.

So I built a system. Not heroic, just systematic.

## Why I Couldn't Just Hit "composer update"

With high-risk apps, blind upgrades are reckless. Nourishd's payment processing can't go down for an afternoon. Canary's prescription data can't have a single integrity issue.

I needed:
- Automated checks to catch breaking changes early
- Staging deployments that mirror production
- Rollback plans if things went sideways
- A way to do this 10 times without losing my mind

## The Script

Here's the bash script I built to upgrade multiple Laravel projects safely:

```bash
#!/bin/bash

# Laravel Multi-Project Upgrade Script
# Usage: ./upgrade-laravel.sh <version>

TARGET_VERSION=$1
PROJECTS=(
  "nourishd"
  "canary"
  "pixel-internal"
  # add more projects here
)

if [ -z "$TARGET_VERSION" ]; then
  echo "Usage: ./upgrade-laravel.sh 12.0"
  exit 1
fi

LOG_FILE="upgrade-$(date +%Y%m%d-%H%M%S).log"

for PROJECT in "${PROJECTS[@]}"; do
  echo "========================================" | tee -a $LOG_FILE
  echo "Upgrading $PROJECT to Laravel $TARGET_VERSION" | tee -a $LOG_FILE
  echo "========================================" | tee -a $LOG_FILE
  
  cd "$HOME/code/$PROJECT" || exit 1
  
  # Ensure we're on main branch
  git checkout main
  git pull origin main
  
  # Create upgrade branch
  BRANCH="upgrade/laravel-${TARGET_VERSION}"
  git checkout -b $BRANCH
  
  # Backup current state
  cp -r vendor "vendor-backup-$(date +%s)"
  
  # Run composer update
  echo "[*] Running composer update..." | tee -a $LOG_FILE
  composer update --no-interaction 2>&1 | tee -a $LOG_FILE
  
  if [ $? -ne 0 ]; then
    echo "[!] Composer update failed for $PROJECT" | tee -a $LOG_FILE
    git reset --hard HEAD
    continue
  fi
  
  # Run tests
  echo "[*] Running tests..." | tee -a $LOG_FILE
  php artisan test 2>&1 | tee -a $LOG_FILE
  
  if [ $? -ne 0 ]; then
    echo "[!] Tests failed for $PROJECT" | tee -a $LOG_FILE
    git reset --hard HEAD
    continue
  fi
  
  # Check for Laravel config deprecations
  echo "[*] Checking config..." | tee -a $LOG_FILE
  php artisan tinker << 'EOF' 2>&1 | tee -a $LOG_FILE
echo "Config check passed";
EOF
  
  # Push branch and create PR
  git push origin $BRANCH
  echo "[✓] $PROJECT upgraded. Review the changes before merging." | tee -a $LOG_FILE
  
  cd - > /dev/null
done

echo ""
echo "Upgrade complete. Log: $LOG_FILE"
```

## What Actually Breaks (The Real Story)

**For Nourishd:**
Laravel 12 itself? Fine. But updating the Stripe SDK? That's where things got messy.

Stripe dropped support for an older API version we were using for subscription management. The payment webhook format changed. Tests caught it immediately — Nourishd's subscription renewals would have silently failed in production.

Fix: Updated the webhook handler, tested with Stripe's sandbox, deployed with zero downtime.

**Pro tip:** You can test Stripe locally with `stripe-mock` instead of hitting the sandbox every time. Faster feedback loop, zero rate limits. Just spin up a Docker container of stripe-mock, point your `.env` to localhost:12111, and run your tests against a real Stripe-compatible mock. Saved us hours of testing.

```bash
# Run stripe-mock locally
docker run --rm -p 12111:12111 stripe/stripe-mock:latest
```

**For Canary:**
Same thing. Laravel 12 was smooth. But a dependency we use for encrypted data storage changed its encryption defaults. The prescription data would still decrypt, but new data would use a different cipher.

We had to explicitly lock the encryption method to maintain backward compatibility with existing prescriptions. Regulatory audit = disaster if we got this wrong.

## The Real Workflow

1. Script runs `composer update`
2. Tests fail → logs tell us exactly what broke
3. We identify the culprit (usually a dependency, not Laravel itself)
4. Fix the breaking change in the dependency
5. Tests pass → we review the diff carefully
6. Staging deployment → manual spot-check
7. Production → we're ready

For boring projects? 15 minutes. For high-stakes ones like Nourishd and Canary? 2-3 hours of careful review, but ZERO surprises in production.

## Why This Scales

As an agency, you'll have 5, 10, 20 client projects. Most will upgrade smoothly. A few will hit gotchas. The system lets you:
- Automate the parts that are identical (dependency updates, tests)
- Focus your human judgment on the parts that matter (risk assessment, breaking changes, client-specific code)

Build the system once. Reuse it forever.
