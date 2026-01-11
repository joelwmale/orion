import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BRIDGE_IP = "192.168.1.80";

async function createApiKey(): Promise<string> {
  const payload = {
    devicetype: "orion#clawd",
    generateclientkey: true,
  };

  const res = await fetch(`http://${BRIDGE_IP}/api`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as Array<{
    success?: { username?: string };
    error?: { description: string };
  }>;

  if (data[0]?.error) {
    throw new Error(`Bridge error: ${data[0].error.description}`);
  }

  if (!data[0]?.success?.username) {
    throw new Error("No username returned from bridge");
  }

  return data[0].success.username;
}

async function discoverLights(apiKey: string): Promise<Record<string, any>> {
  const res = await fetch(`http://${BRIDGE_IP}/api/${apiKey}/lights`);
  return await res.json();
}

async function main() {
  console.log(`\n📱 Setting up Philips Hue Bridge at ${BRIDGE_IP}`);
  console.log("⏳ Make sure you pressed the bridge button in the last 30 seconds...\n");

  try {
    console.log("🔑 Creating API key...");
    const apiKey = await createApiKey();
    console.log(`✅ API key created: ${apiKey}\n`);

    console.log("🔦 Discovering lights...");
    const lights = await discoverLights(apiKey);
    console.log(`✅ Found ${Object.keys(lights).length} lights:\n`);

    for (const [id, light] of Object.entries(lights)) {
      console.log(`   ${id}: ${(light as any).name}`);
    }

    // Save credentials
    const credDir = join(homedir(), ".clawdbot", "credentials");
    if (!existsSync(credDir)) {
      mkdirSync(credDir, { recursive: true });
    }

    const credFile = join(credDir, "philips-hue.json");
    writeFileSync(
      credFile,
      JSON.stringify(
        {
          bridgeIp: BRIDGE_IP,
          apiKey,
        },
        null,
        2
      ),
      { mode: 0o600 }
    );

    console.log(`\n✅ Credentials saved to ${credFile}`);
  } catch (err) {
    console.error(`\n❌ Error: ${err}`);
    process.exit(1);
  }
}

main();
