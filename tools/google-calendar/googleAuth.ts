import { createServer } from "node:http";
import { URL } from "node:url";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { fileExists, readJsonFile, writeJsonFile } from "./fsUtil";

type InstalledCredentials = {
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
};

export async function getOAuthClient(params: {
  credentialsPath: string;
  tokenPath: string;
  scopes: string[];
  requireLocalhostRedirect?: boolean;
  forceReauth?: boolean;
}): Promise<OAuth2Client> {
  const creds = readJsonFile<InstalledCredentials>(params.credentialsPath);
  const web = creds.web;
  if (!web?.client_id || !web.client_secret || !web.redirect_uris?.length) {
    throw new Error(
      `Invalid credentials at ${params.credentialsPath}. Expected a "web" OAuth client with client_id/client_secret/redirect_uris.`
    );
  }

  const redirectUri = chooseRedirectUri(web.redirect_uris);
  const oAuth2Client = new google.auth.OAuth2(web.client_id, web.client_secret, redirectUri);

  if (!params.forceReauth && fileExists(params.tokenPath)) {
    const token = readJsonFile<unknown>(params.tokenPath);
    oAuth2Client.setCredentials(token as any);
    return oAuth2Client;
  }

  const tokens = await authorizeViaLocalServer(oAuth2Client, params.scopes, {
    requireLocalhostRedirect: params.requireLocalhostRedirect ?? true,
  });
  writeJsonFile(params.tokenPath, tokens);
  oAuth2Client.setCredentials(tokens);
  return oAuth2Client;
}

function chooseRedirectUri(redirectUris: string[]): string {
  const preferred = redirectUris.find((u) => u.startsWith("http://localhost"));
  return preferred ?? redirectUris[0]!;
}

async function authorizeViaLocalServer(
  oAuth2Client: OAuth2Client,
  scopes: string[],
  opts: { requireLocalhostRedirect: boolean }
) {
  const redirectUri = oAuth2Client.redirectUri;
  if (!redirectUri) throw new Error("OAuth2 client is missing redirectUri");

  const redirect = new URL(redirectUri);
  if (opts.requireLocalhostRedirect && redirect.hostname !== "localhost") {
    throw new Error(
      `This helper only supports localhost redirect URIs. Got: ${redirectUri}. Add http://localhost:3000/oauth2callback to your OAuth client redirect URIs.`
    );
  }

  const port = Number(redirect.port || "3000");
  const path = redirect.pathname;

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      try {
        if (!req.url) {
          res.writeHead(400);
          res.end("Missing URL");
          return;
        }

        const requestUrl = new URL(req.url, `http://localhost:${port}`);
        if (requestUrl.pathname !== path) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const error = requestUrl.searchParams.get("error");
        if (error) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end(`Authorization failed: ${error}`);
          server.close();
          reject(new Error(`Authorization failed: ${error}`));
          return;
        }

        const codeParam = requestUrl.searchParams.get("code");
        if (!codeParam) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Missing code parameter");
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<p>Orion is linked. You can close this tab.</p>");
        server.close();
        resolve(codeParam);
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(port, "localhost", () => {
      // eslint-disable-next-line no-console
      console.log("\nOpen this URL to authorize Orion:\n" + authUrl + "\n");
      // eslint-disable-next-line no-console
      console.log(`Waiting for the OAuth redirect on ${redirectUri} ...\n`);
    });

    server.on("error", (err) => reject(err));
  });

  const { tokens } = await oAuth2Client.getToken(code);
  return tokens;
}
