# The Real Cost of Ignoring Composer Updates

You skip the `composer update` email. It sits in your inbox. The changelog is long, breaking changes seem risky, and your app is working fine, so why bother?

Then it happens. Someone finds a known vulnerability in a dependency you haven't updated in months.

That's a lesson we learned the hard way at Pixel last year. One of our clients discovered unauthorized database access. The culprit wasn't a zero-day exploit or sophisticated attack. It was a known vulnerability in Livewire 3.6.3 that had been patched months earlier.

## The Livewire 3.6.4 Incident

In mid-2025, Livewire released version 3.6.4. Buried in the changelog was a critical security fix that patched a remote code execution vulnerability in earlier versions.

The vulnerability? Older Livewire versions had insufficient validation on file uploads and certain request handlers. If you were running anything before 3.6.4, an attacker could craft a specific request and execute code on your server.

The client was running Livewire 3.6.1. They'd upgraded to Laravel 12.x, but the Livewire update got pushed to the backlog. "It's working fine," the thinking goes. "We'll do it next sprint."

Then an attacker found the vulnerability and exploited it. Unauthorized database access. Not data stolen (thankfully), but close.

We caught it relatively quickly. But the incident response, security audit, credential rotations, and log analysis took time and resources. More importantly, it was completely preventable. If we'd been monitoring composer.lock for known vulnerabilities, or if Dependabot was enabled, we would've caught it the day the patch was released.

That's when we realized: we weren't doing composer security right.

## Why This Happens (And Why It's Hard to Stop)

If you're managing 5, 10, 20 Laravel projects for different clients, here's the reality:

- Each project has its own composer.lock
- Each dependency has its own vulnerability timeline
- Each vulnerability disclosure happens on a different schedule
- You can't just update everything blindly (breaking changes, testing overhead)
- But you also can't ignore everything (security isn't optional)

So what do most teams do? They update reactively when they remember, or when a client specifically asks, or when they have a window in the sprint. It's not malice. It's just competing priorities and the complexity of managing multiple codebases. But that window of reactive response is the dangerous gap.

The smarter approach: automate the monitoring. Let tools tell you what's broken. Then you prioritize fixes based on severity and risk.

## The Real Costs (Beyond the Hack)

**Direct costs:**
- Incident response time (4-8 hours of billable work)
- Security audit (clients hire external auditors, you're liable if it was your negligence)
- Credential rotation and log forensics
- Potential data breach notifications (regulatory requirement)

**Hidden costs:**
- Client trust erosion (they'll never fully trust you again)
- Reputation damage (clients talk to other clients)
- Distraction from actual work (you're firefighting instead of shipping)
- Regulatory fines (GDPR, PIPEDA, etc. if data was exposed)

For our client, it was a 20-hour incident response + a $5,000 security audit + a lost renewal because they switched agencies. Not catastrophic, but absolutely avoidable.

## The Fix: Three Layers of Automation

You can't manually check every dependency of every project. You need systems.

### Layer 1: GitHub's Dependabot (Free, Dead Simple)

Enable Dependabot on every repository. GitHub will scan your composer.lock every day and alert you to vulnerabilities.

```bash
# In your GitHub repo settings:
# 1. Go to Settings → Security & Analysis
# 2. Enable "Dependabot alerts"
# 3. (Optional) Enable "Dependabot security updates" for auto-PRs
```

This catches 90% of known vulnerabilities. But it only works if you're looking at GitHub.

### Layer 2: Composer Security Scanner (Local Automation)

For your own projects or CI/CD, use Composer's built-in security checker:

```bash
composer audit
```

This command checks your installed dependencies against a vulnerability database (maintained by FriendsOfPHP). Run it in CI/CD before every deploy:

```yaml
# .github/workflows/security.yml
name: Security Audit

on:
  push:
    branches: [main, develop]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2am

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: php-actions/composer@v6
      - run: composer audit --format=json
```

This blocks deployments if vulnerabilities are found. It forces you to deal with it.

### Layer 3: Clawdbot Scanning (Agency-Scale Monitoring)

For managing multiple projects at once, you need a tool that can:
1. Clone all your project repos
2. Run `composer audit` across all of them
3. Summarize what's broken
4. Report back to you

Here's a bash script I built for Pixel:

```bash
#!/bin/bash
# scan-vulnerabilities.sh
# Usage: ./scan-vulnerabilities.sh [output-file]

OUTPUT_FILE="${1:-vulnerability-report.txt}"
PROJECTS=(
  "path/to/nourishd"
  "path/to/canary"
  "path/to/pixel-client-1"
  "path/to/pixel-client-2"
  # add more...
)

echo "🔍 Scanning projects for vulnerabilities..." > "$OUTPUT_FILE"
echo "Report generated: $(date)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

CRITICAL_COUNT=0
HIGH_COUNT=0

for PROJECT in "${PROJECTS[@]}"; do
  PROJECT_NAME=$(basename "$PROJECT")
  echo "Scanning $PROJECT_NAME..." | tee -a "$OUTPUT_FILE"
  
  cd "$PROJECT" || continue
  
  # Run composer audit and capture output
  AUDIT_RESULT=$(composer audit --format=json 2>/dev/null)
  VULNERABILITIES=$(echo "$AUDIT_RESULT" | jq '.vulnerabilities | length')
  
  if [ "$VULNERABILITIES" -gt 0 ]; then
    echo "  ⚠️  Found $VULNERABILITIES vulnerabilities:" >> "$OUTPUT_FILE"
    echo "$AUDIT_RESULT" | jq -r '.vulnerabilities[] | "    - \(.title) (Severity: \(.severity))"' >> "$OUTPUT_FILE"
    
    # Count severity
    CRITICAL=$(echo "$AUDIT_RESULT" | jq '[.vulnerabilities[] | select(.severity=="critical")] | length')
    HIGH=$(echo "$AUDIT_RESULT" | jq '[.vulnerabilities[] | select(.severity=="high")] | length')
    
    CRITICAL_COUNT=$((CRITICAL_COUNT + CRITICAL))
    HIGH_COUNT=$((HIGH_COUNT + HIGH))
  else
    echo "  ✅ No vulnerabilities" >> "$OUTPUT_FILE"
  fi
  
  cd - > /dev/null
done

echo "" >> "$OUTPUT_FILE"
echo "Summary:" >> "$OUTPUT_FILE"
echo "  Critical: $CRITICAL_COUNT" >> "$OUTPUT_FILE"
echo "  High: $HIGH_COUNT" >> "$OUTPUT_FILE"

if [ $CRITICAL_COUNT -gt 0 ]; then
  echo "" >> "$OUTPUT_FILE"
  echo "🚨 CRITICAL VULNERABILITIES FOUND - Action Required" >> "$OUTPUT_FILE"
  echo "Review the report above and update immediately." >> "$OUTPUT_FILE"
fi

cat "$OUTPUT_FILE"
```

Run this weekly via cron and pipe the output to your Slack/email/dashboard. You'll see exactly which projects have vulnerabilities and how severe they are.

### Bonus: GitHub API for Enterprise Scanning

If your projects are on GitHub, use the GitHub Security API to fetch vulnerability alerts programmatically:

```bash
curl -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/OWNER/REPO/security-advisories" \
  | jq '.[] | {vulnerability: .cve_id, severity: .cvss_score}'
```

This gives you raw data you can plug into your own dashboard.

## What We Do Now at Pixel

1. **Dependabot enabled on every repo** — GitHub emails us about vulnerabilities the day they're disclosed
2. **Weekly composer audit via cron** — Script runs every Monday, emails me the report
3. **Pre-deploy security gate** — CI/CD blocks deployments if `composer audit` fails
4. **Quarterly manual review** — We review older dependencies and assess upgrade risk

It's not perfect. We still get surprised sometimes. But we've caught dozens of vulnerabilities before they became incidents.

The Livewire 3.6.4 thing? It would be caught within a day now. Not six months later.

## The Livewire Lesson (And It Applies Everywhere)

Livewire isn't unique. Last year alone there were critical vulnerabilities in:
- Laravel's session handling
- Illuminate routing (RCE in some cases)
- Popular packages like Spatie's permission library
- Database drivers and caching backends

Each one followed the same pattern:
1. Vulnerability disclosed
2. Patch released
3. Teams deprioritize it because "our stuff still works"
4. Months pass, the patch sits in the changelog
5. Someone notices the vulnerability and it becomes urgent (or worse, it gets exploited)

It's not unique to any one team. It's a classic product timeline issue: security updates get deprioritized in favor of features, and then something forces the issue.

## Your Action Plan

**This week:**
- Enable Dependabot on all your GitHub repos (Settings → Security & Analysis)
- Run `composer audit` locally on every active project
- Document any vulnerabilities you find

**This month:**
- Add `composer audit` to your CI/CD pipeline
- Set up a weekly vulnerability scan across all projects
- Create a vulnerability response SLA (e.g., critical = 24 hours, high = 1 week)

**Going forward:**
- Monitor the FriendsOfPHP security advisories feed
- Subscribe to Laravel security announcements
- Treat composer updates as a feature, not a chore

The cost of ignoring composer updates is higher than you think. We learned that lesson. Now you can learn it without the incident response at 2am.

Set up the automations. Make it boring. Make it so you don't have to think about it. That's how you win.
