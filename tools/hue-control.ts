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
  
  // Check if it's a room name
  if (rooms[input.toLowerCase()]) {
    return rooms[input.toLowerCase()];
  }
  
  // Otherwise treat as light ID
  const id = parseInt(input, 10);
  if (isNaN(id)) {
    throw new Error(`Unknown room or light: ${input}`);
  }
  return [id];
}

async function getLight(config: HueConfig, id: string): Promise<any> {
  const res = await fetch(`http://${config.bridgeIp}/api/${config.apiKey}/lights/${id}`);
  if (!res.ok) throw new Error(`Light ${id} not found`);
  return await res.json();
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

async function getAllLights(config: HueConfig): Promise<Record<string, any>> {
  const res = await fetch(`http://${config.bridgeIp}/api/${config.apiKey}/lights`);
  return await res.json();
}

// RGB to XY (CIE 1931 color space)
function rgbToXy(r: number, g: number, b: number): [number, number] {
  // Normalize
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;

  // Gamma correction
  const rGamma = red > 0.04045 ? Math.pow((red + 0.055) / 1.055, 2.4) : red / 12.92;
  const gGamma = green > 0.04045 ? Math.pow((green + 0.055) / 1.055, 2.4) : green / 12.92;
  const bGamma = blue > 0.04045 ? Math.pow((blue + 0.055) / 1.055, 2.4) : blue / 12.92;

  // Wide RGB D65
  const X = rGamma * 0.664511 + gGamma * 0.154324 + bGamma * 0.162028;
  const Y = rGamma * 0.283881 + gGamma * 0.668433 + bGamma * 0.047685;
  const Z = rGamma * 0.0 + gGamma * 0.01252 + bGamma * 0.773231;

  const x = X / (X + Y + Z) || 0.3;
  const y = Y / (X + Y + Z) || 0.33;

  return [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const config = loadConfig();

  try {
    switch (command) {
      case "on": {
        const input = args[0];
        if (!input) throw new Error("Usage: hue-control on <light-id|room>");
        const ids = resolveLightIds(input);
        const names: string[] = [];
        for (const id of ids) {
          await setLightState(config, String(id), { on: true });
          const light = await getLight(config, String(id));
          names.push(light.name);
        }
        console.log(`✅ ${names.join(", ")} turned ON`);
        break;
      }

      case "off": {
        const input = args[0];
        if (!input) throw new Error("Usage: hue-control off <light-id|room>");
        const ids = resolveLightIds(input);
        const names: string[] = [];
        for (const id of ids) {
          await setLightState(config, String(id), { on: false });
          const light = await getLight(config, String(id));
          names.push(light.name);
        }
        console.log(`✅ ${names.join(", ")} turned OFF`);
        break;
      }

      case "brightness": {
        const input = args[0];
        const bri = parseInt(args[1], 10);
        if (!input || isNaN(bri)) throw new Error("Usage: hue-control brightness <light-id|room> <0-254>");
        if (bri < 0 || bri > 254) throw new Error("Brightness must be 0-254");
        const ids = resolveLightIds(input);
        const names: string[] = [];
        for (const id of ids) {
          await setLightState(config, String(id), { bri });
          const light = await getLight(config, String(id));
          names.push(light.name);
        }
        console.log(`✅ ${names.join(", ")} brightness set to ${bri}`);
        break;
      }

      case "color": {
        const input = args[0];
        const r = parseInt(args[1], 10);
        const g = parseInt(args[2], 10);
        const b = parseInt(args[3], 10);
        if (!input || isNaN(r) || isNaN(g) || isNaN(b)) {
          throw new Error("Usage: hue-control color <light-id|room> <red> <green> <blue>");
        }
        const [x, y] = rgbToXy(r, g, b);
        const ids = resolveLightIds(input);
        const names: string[] = [];
        for (const id of ids) {
          await setLightState(config, String(id), { xy: [x, y] });
          const light = await getLight(config, String(id));
          names.push(light.name);
        }
        console.log(`✅ ${names.join(", ")} color set to RGB(${r}, ${g}, ${b})`);
        break;
      }

      case "info": {
        const id = args[0];
        if (!id) throw new Error("Usage: hue-control info <light-id>");
        const light = await getLight(config, id);
        console.log(`\n📍 ${light.name}`);
        console.log(`   State: ${light.state.on ? "ON" : "OFF"}`);
        console.log(`   Brightness: ${light.state.bri}/254`);
        console.log(`   Reachable: ${light.state.reachable ? "Yes" : "No"}`);
        if (light.state.xy) {
          console.log(`   XY: [${light.state.xy[0].toFixed(3)}, ${light.state.xy[1].toFixed(3)}]`);
        }
        break;
      }

      case "list": {
        const lights = await getAllLights(config);
        console.log("\n🔦 Your Lights:\n");
        for (const [id, light] of Object.entries(lights)) {
          const status = (light as any).state.on ? "ON" : "OFF";
          console.log(`   ${id}: ${(light as any).name} (${status})`);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error(
          "\nUsage: hue-control [on|off|brightness|color|info|list] <args>"
        );
        process.exit(1);
    }
  } catch (err) {
    console.error(`❌ Error: ${err}`);
    process.exit(1);
  }
}

main();
