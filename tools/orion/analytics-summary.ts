import { spawnSync } from "node:child_process";

function runCommand(cmd: string, args: string[]): string {
  const res = spawnSync(cmd, args, { encoding: "utf8" });
  if (res.status !== 0) {
    return "";
  }
  return res.stdout.trim();
}

async function main() {
  console.log("📊 7-Day Analytics Summary\n");

  // Get joelmale stats
  const joelmaleOutput = runCommand("bun", ["tools/orion/pirsch-analytics.ts", "joelmale", "7"]);
  const joelmaleData = joelmaleOutput ? JSON.parse(joelmaleOutput) : null;

  // Get rethread stats
  const rethreadOutput = runCommand("bun", ["tools/orion/pirsch-analytics.ts", "rethread", "7"]);
  const rethreadData = rethreadOutput ? JSON.parse(rethreadOutput) : null;

  if (joelmaleData) {
    // eslint-disable-next-line no-console
    console.log("🌐 joelmale.com");
    // eslint-disable-next-line no-console
    console.log(`  Visitors: ${joelmaleData.visitors}`);
    // eslint-disable-next-line no-console
    console.log(`  Views: ${joelmaleData.views}`);
    // eslint-disable-next-line no-console
    console.log(
      `  Trend: ${(joelmaleData.growth.visitors * 100).toFixed(1)}% visitors, ${(joelmaleData.growth.views * 100).toFixed(1)}% views`
    );
  }

  if (rethreadData) {
    // eslint-disable-next-line no-console
    console.log("\n👕 rethread.com.au");
    // eslint-disable-next-line no-console
    console.log(`  Visitors: ${rethreadData.visitors}`);
    // eslint-disable-next-line no-console
    console.log(`  Views: ${rethreadData.views}`);
    // eslint-disable-next-line no-console
    console.log(
      `  Trend: ${(rethreadData.growth.visitors * 100).toFixed(1)}% visitors, ${(rethreadData.growth.views * 100).toFixed(1)}% views`
    );
  }
}

main();
