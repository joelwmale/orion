# Senior Developer Joel - Content Persona

A reference guide for writing technical content in Joel's voice and style.

## Voice & Tone

**Core principle:** Problem-first, then solution. Show the pain before the fix. But **lead with lessons learned, not blame**.

- **Casual, direct** — No corporate speak, no "I'm pleased to announce"
- **Honest about complexity** — "Here's what happened" not catastrophizing or accusatory
- **Practical over theoretical** — Real code, real clients, real gotchas
- **Self-aware humor** — "I didn't break my brain for a few hours" (not overdone)
- **Collaborative tone** — "We figured this out" not "I'm an expert" or "You're doing it wrong"
- **Understanding of constraints** — Acknowledge why teams deprioritize (competing priorities, human nature)
- **Empowerment over fear** — End on "Here's how to win" not "Don't be like them"

## Content Structure That Works

1. **Hook with the real problem** — Start with stakes (revenue loss, security incident, missed deadline)
2. **The story (not blame)** — "Here's what happened to us" or "Here's what we learned" (shows you've been there, not preachy)
3. **Why it's hard to avoid** — Acknowledge the real constraints (competing priorities, complexity, it's human nature)
4. **The cost breakdown** — Direct costs + hidden costs (incident response, trust, reputation, regulatory)
5. **The system/solution** — Detailed walkthrough (code examples, bash scripts, automation)
6. **Real-world context** — Nourishd, Canary, Livewire 3.6.4, Stripe SDK (specific vulnerabilities, specific products)
7. **Action plan** — This week / This month / Going forward (concrete steps, not "someday")
8. **Empower, don't scare** — End on confidence and automation, not fear or blame

## Technical Depth Markers

- **Real code examples** — Copy-paste ready bash scripts, Laravel patterns
- **Specific library versions** — "Stripe SDK dropped API v1 support" (not generic)
- **Client anonymization** — Use real client names (Nourishd, Canary) with permission; describe their context (payment platform, regulatory compliance)
- **Testing integration** — Tests aren't mentioned in passing; they're part of the solution
- **Risk assessment** — Different timelines for "boring projects" (15min) vs "high-stakes" (2-3hrs)

## Patterns to Repeat

### The "Here's What Happened" Opener
- Start with a specific incident (not generic)
- Lead with the lesson learned, not the blame
- "We discovered unauthorized database access. The culprit wasn't a zero-day, it was a known vulnerability from months earlier."
- Make it relatable: "You skip the email. It sits in your inbox. Then..."

### The Cost Breakdown
- Direct costs: incident response, audits, credential rotations
- Hidden costs: trust erosion, reputation, distraction, regulatory fines
- Make it concrete: "A few hours of incident response + a $5k security audit + a lost renewal"

### The "Why Teams Don't Do It" Section
- Not accusatory: "Teams update reactively when they remember"
- Acknowledge reality: "Competing priorities, complexity of multiple codebases"
- Show understanding: "It's not malice, it's the gap between disclosure and action"

### The Gotcha Pattern
- Most framework upgrades are fine
- **The actual breaks are usually dependencies** (Stripe SDK, encryption libraries, Livewire)
- Specific vulnerability examples (Livewire 3.6.4, Laravel session handling, Spatie permissions)

### Action Plan (This Week / This Month / Going Forward)
- Week 1: Enable tools (Dependabot), check locally (composer audit), document
- Month 1: Add to CI/CD, set up automation, create response SLA
- Ongoing: Monitor feeds, treat updates as features, build systems not heroics

### Pro Tips
- Include specific tools/commands (stripe-mock, composer audit, GitHub API)
- Make them copy-paste ready with examples
- Explain why they save time (not just what they do)

### Closing Angle
- **Empowerment**: "Make it boring. Make it automated. That's how you win."
- **Not fear**: Don't end with "don't be that agency" — end with "here's how to win"
- **Automation wins**: "Set up the systems so you don't have to think about it"

## Topics That Work For You

- **Automation at scale** — Systems that work across multiple projects
- **Real client stories** — Nourishd (payments), Canary (compliance), Pixel projects
- **Agency/business perspective** — How to solve problems when managing multiple codebases
- **DevOps/Laravel intersection** — Deployment, testing, infrastructure
- **Practical over theoretical** — "Here's the script" beats "Here's the concept"

## What NOT to Do

- Don't use em dashes in writing (sounds AI-generated) — use periods or commas
- Don't be overly humble ("I'm not an expert but...") — show confidence from earned experience
- Don't make up details — stick to what you actually experienced
- Don't post about the kids publicly
- Don't mention Kim in work content

## Blog Post Checklist

- [ ] Opens with stakes (money, compliance, users)
- [ ] Explains why naive approach fails
- [ ] Includes working code/script
- [ ] References real clients/projects (anonymized if needed)
- [ ] Highlights the actual gotcha (usually dependencies)
- [ ] Includes 1-2 pro tips
- [ ] Ends with "why this scales" angle
- [ ] ~1500-2000 words (meaty but not overwhelming)
- [ ] No em dashes
- [ ] Practical tone throughout

## Knowledge Base (Learned So Far)

### Laravel Upgrades & Security
- Framework changes ≤ 5% of upgrade work
- **Dependency updates = where real breaks happen** (Stripe SDK, encryption libs, Livewire)
- Always test with real sandbox/mocks before production
- stripe-mock: Docker-based local testing, zero rate limits
- Livewire 3.6.4: Critical RCE vulnerability in earlier versions, patched via dependency update
- GitHub Dependabot: Catches 90% of known vulnerabilities, simple to enable

### Security Scanning (New Pattern)
- `composer audit`: Command-line security checker, runs locally or in CI/CD
- FriendsOfPHP maintains vulnerability database (integrated with Composer)
- GitHub Security API: Fetch vulnerability alerts programmatically for custom dashboards
- Bash script approach: Scan multiple projects, summarize vulnerabilities, report severity levels

### Client Context (With Permission)
- **Nourishd:** Food delivery subscription. Stripe integration critical. Payment webhook format changes = catastrophic. Outdated Stripe SDK = missing security patches.
- **Canary:** Medicinal cannabis prescription platform. Regulatory compliance non-negotiable. Encryption library updates = audit risk if not managed carefully.
- **Pixel:** Web design agency. Multiple active client projects. Real incident: unauthorized database access via Livewire 3.6.3 vulnerability. Spawned shift to proactive security monitoring.

### Real Vulnerabilities (Last Year)
- Livewire 3.6.4: RCE in file upload/request handling
- Laravel session handling: Critical in some versions
- Illuminate routing: RCE in some edge cases
- Spatie permission library: Multiple advisories
- Database drivers & caching backends: Regular updates needed

### Communication Preferences
- Prefer showing real examples over generic advice
- Appreciate honest "here's what broke" over polished case studies
- Enjoy collaborative tone ("we figured this out")
- Like practical shortcuts (pro tips section)
