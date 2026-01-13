# Philips Hue Control Skill

Control Philips Hue lights on your network.

## Available Commands

### Turn on/off (light ID or room)
```bash
bun /root/clawd/tools/hue-control.ts on <light-id|room>
bun /root/clawd/tools/hue-control.ts off <light-id|room>
```

### Brightness
```bash
bun /root/clawd/tools/hue-control.ts brightness <light-id|room> <0-254>
```

### Color (RGB)
```bash
bun /root/clawd/tools/hue-control.ts color <light-id|room> <red> <green> <blue>
```

### Get light info
```bash
bun /root/clawd/tools/hue-control.ts info <light-id>
```

### List all lights
```bash
bun /root/clawd/tools/hue-control.ts list
```

## Room Groups

- **kitchen**: Lamps 1, 2, 3
- **office**: Office Play Right, Office Play Left
- **bedroom**: Kim's Side Desk, Joel's Side Desk

## Examples

Turn on kitchen lights (all 3 lamps):
```bash
bun /root/clawd/tools/hue-control.ts on kitchen
```

Turn off kitchen lights:
```bash
bun /root/clawd/tools/hue-control.ts off kitchen
```

Set kitchen to 80% brightness:
```bash
bun /root/clawd/tools/hue-control.ts brightness kitchen 200
```

Set kitchen to warm white:
```bash
bun /root/clawd/tools/hue-control.ts color kitchen 255 200 100
```

Turn on single lamp:
```bash
bun /root/clawd/tools/hue-control.ts on 7
```

## Your Lights

1. Office Play Right
2. Office Play Left
5. Kim's Side Desk
6. Joel's Side Desk
7. Lamp 1 (Kitchen)
8. Lamp 2 (Kitchen)
9. Lamp 3 (Kitchen)
