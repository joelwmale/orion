import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface HueConfig {
  bridgeIp: string;
  apiKey: string;
}

function loadConfig(): HueConfig {
  const path = join(homedir(), ".clawdbot", "credentials", "philips-hue.json");
  if (!existsSync(path)) {
    throw new Error(`Hue config not found at ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadRooms(): Record<string, number[]> {
  const path = "/root/clawd/config/hue-rooms.json";
  if (!existsSync(path)) {
    return {};
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function resolveLightIds(input: string): number[] {
  const rooms = loadRooms();
  
  if (rooms[input.toLowerCase()]) {
    return rooms[input.toLowerCase()];
  }
  
  const id = parseInt(input, 10);
  if (isNaN(id)) {
    throw new Error(`Unknown room or light: ${input}`);
  }
  return [id];
}

async function setLightState(
  config: HueConfig,
  id: string,
  state: Record<string, any>
): Promise<any> {
  const res = await fetch(`http://${config.bridgeIp}/api/${config.apiKey}/lights/${id}/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  return await res.json();
}

// RGB to XY (CIE 1931 color space)
function rgbToXy(r: number, g: number, b: number): [number, number] {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;

  const rGamma = red > 0.04045 ? Math.pow((red + 0.055) / 1.055, 2.4) : red / 12.92;
  const gGamma = green > 0.04045 ? Math.pow((green + 0.055) / 1.055, 2.4) : green / 12.92;
  const bGamma = blue > 0.04045 ? Math.pow((blue + 0.055) / 1.055, 2.4) : blue / 12.92;

  const X = rGamma * 0.664511 + gGamma * 0.154324 + bGamma * 0.162028;
  const Y = rGamma * 0.283881 + gGamma * 0.668433 + bGamma * 0.047685;
  const Z = rGamma * 0.0 + gGamma * 0.01252 + bGamma * 0.773231;

  const x = X / (X + Y + Z) || 0.3;
  const y = Y / (X + Y + Z) || 0.33;

  return [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
}

async function disco(input: string, duration: number = 10000) {
  const config = loadConfig();
  const ids = resolveLightIds(input);

  // Disco colors (vibrant RGB values)
  const colors = [
    [255, 0, 0],      // Red
    [255, 165, 0],    // Orange
    [255, 255, 0],    // Yellow
    [0, 255, 0],      // Green
    [0, 0, 255],      // Blue
    [75, 0, 130],     // Indigo
    [148, 0, 211],    // Violet
    [255, 0, 127],    // Pink
  ];

  const startTime = Date.now();
  let colorIndex = 0;

  console.log(`🕺 DISCO MODE! Hold tight for ${duration / 1000} seconds...\n`);

  // Ensure lights are on and max brightness
  for (const id of ids) {
    await setLightState(config, String(id), { on: true, bri: 254 });
  }

  // Loop through colors
  while (Date.now() - startTime < duration) {
    const [r, g, b] = colors[colorIndex];
    const [x, y] = rgbToXy(r, g, b);

    // Update all lights in the room simultaneously
    for (const id of ids) {
      await setLightState(config, String(id), { xy: [x, y] });
    }

    colorIndex = (colorIndex + 1) % colors.length;
    
    // Tempo: 200ms per color change = 5 colors/sec = fast disco!
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // End with white
  const [x, y] = rgbToXy(255, 255, 255);
  for (const id of ids) {
    await setLightState(config, String(id), { xy: [x, y] });
  }

  console.log("✅ Disco complete! Lights reset to white.");
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (command === "disco") {
    const input = args[0] || "kitchen";
    const duration = parseInt(args[1], 10) || 10000;

    try {
      await disco(input, duration);
    } catch (err) {
      console.error(`❌ Error: ${err}`);
      process.exit(1);
    }
  } else {
    console.error("Usage: hue-disco disco <room|light-id> [duration-ms]");
    console.error("Example: hue-disco disco kitchen 10000");
  }
}

main();
