# Custom Commands

## Orion-Specific Voice Commands

When Joel says these phrases, run the corresponding commands:

### Lighting

**"party mode"** or **"disco"**
```bash
bun /root/clawd/tools/hue-disco.ts disco kitchen 15000
```

**"turn on [room] lights"**
```bash
bun /root/clawd/tools/hue-control.ts on [room]
```
Rooms: kitchen, office, bedroom, or specific light ID

**"turn off [room] lights"**
```bash
bun /root/clawd/tools/hue-control.ts off [room]
```

**"set [room] to [color]"**
```bash
bun /root/clawd/tools/hue-control.ts color [room] [r] [g] [b]
```
Examples:
- "set kitchen to white" → RGB 255 255 255
- "set kitchen to orange" → RGB 255 140 0
- "set kitchen to purple" → RGB 128 0 255
- "set kitchen to blue" → RGB 0 0 255

**"set [room] brightness to [0-100]%"**
```bash
bun /root/clawd/tools/hue-control.ts brightness [room] [0-254]
```
Convert percentage: (percentage / 100) * 254

### Content

**"post [text] to Twitter"**
```bash
bun /root/clawd/tools/orion/twitter-post.ts post "[text]"
```
(Auto-threads if > 160 chars)

---

## Aliases

When writing about Joel in my voice, use VOICE.md patterns (no em dashes, problem-first approach, self-deprecating humor).

When controlling lights, reference hue-rooms.json for room groupings.
