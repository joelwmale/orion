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

// Split text into tweets under 160 chars (free tier limit)
function splitIntoTweets(text: string): string[] {
  const CHAR_LIMIT = 160;
  
  if (text.length <= CHAR_LIMIT) {
    return [text];
  }

  // Split by sentences (period, question mark, exclamation)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  const tweets: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    
    if ((current + " " + trimmed).length <= CHAR_LIMIT) {
      current = current ? current + " " + trimmed : trimmed;
    } else {
      if (current) tweets.push(current);
      current = trimmed;
    }
  }

  if (current) tweets.push(current);

  return tweets.length > 0 ? tweets : [text]; // Fallback
}

async function postThread(tweets: string[]): Promise<Array<{ id: string; url: string }>> {
  const creds = loadCredentials();

  const client = new TwitterApi({
    appKey: creds.consumer_key,
    appSecret: creds.consumer_secret,
    accessToken: creds.access_token,
    accessSecret: creds.access_token_secret,
  });

  const rwClient = client.readWrite;
  const results: Array<{ id: string; url: string }> = [];
  let previousId: string | null = null;

  try {
    for (const text of tweets) {
      let result;
      
      if (previousId) {
        result = await rwClient.v2.tweet(text, {
          reply: { in_reply_to_tweet_id: previousId },
        });
      } else {
        result = await rwClient.v2.tweet(text);
      }

      previousId = result.data.id;
      results.push({
        id: result.data.id,
        url: `https://x.com/joelwmale/status/${result.data.id}`,
      });
    }

    return results;
  } catch (err: unknown) {
    const error = err as { message?: string; code?: number };
    throw new Error(`Twitter API error: ${error.message || String(err)}`);
  }
}

async function postTweet(text: string): Promise<{ id: string; url: string } | Array<{ id: string; url: string }>> {
  const tweets = splitIntoTweets(text);
  
  if (tweets.length === 1) {
    // Single tweet
    const creds = loadCredentials();
    const client = new TwitterApi({
      appKey: creds.consumer_key,
      appSecret: creds.consumer_secret,
      accessToken: creds.access_token,
      accessSecret: creds.access_token_secret,
    });

    try {
      const result = await client.readWrite.v2.tweet(tweets[0]);
      return {
        id: result.data.id,
        url: `https://x.com/joelwmale/status/${result.data.id}`,
      };
    } catch (err: unknown) {
      const error = err as { message?: string; code?: number };
      throw new Error(`Twitter API error: ${error.message || String(err)}`);
    }
  } else {
    // Thread
    return await postThread(tweets);
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
