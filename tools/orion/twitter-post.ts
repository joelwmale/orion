import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { TwitterApi } from "twitter-api-v2";

interface OAuth1aCredentials {
  consumer_key: string;
  consumer_secret: string;
  access_token: string;
  access_token_secret: string;
}

function loadCredentials(): OAuth1aCredentials {
  const path = join(homedir(), ".clawdbot", "credentials", "joelmale-twitter-oauth1a.json");
  if (!existsSync(path)) {
    throw new Error(`Credentials not found at ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

async function postTweet(text: string): Promise<{ id: string; url: string }> {
  const creds = loadCredentials();

  const client = new TwitterApi({
    appKey: creds.consumer_key,
    appSecret: creds.consumer_secret,
    accessToken: creds.access_token,
    accessSecret: creds.access_token_secret,
  });

  const rwClient = client.readWrite;

  try {
    const result = await rwClient.v2.tweet(text);
    return {
      id: result.data.id,
      url: `https://x.com/joelwmale/status/${result.data.id}`,
    };
  } catch (err: unknown) {
    const error = err as { message?: string; code?: number };
    throw new Error(`Twitter API error: ${error.message || String(err)}`);
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    // eslint-disable-next-line no-console
    console.error("Usage: twitter-post post <text>");
    process.exitCode = 1;
    return;
  }

  if (command === "post") {
    const text = args.join(" ");
    if (!text) {
      // eslint-disable-next-line no-console
      console.error("Please provide tweet text");
      process.exitCode = 1;
      return;
    }

    try {
      const result = await postTweet(text);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(String(err?.message ?? err));
      process.exitCode = 1;
    }
  } else {
    // eslint-disable-next-line no-console
    console.error(`Unknown command: ${command}`);
    process.exitCode = 1;
  }
}

main();
