import http from "node:http";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "../config.js";

const host = process.env.POLYGLOT_LIVE_HOST || "127.0.0.1";
const port = Number(process.env.POLYGLOT_LIVE_PORT || 8787);
const geminiApiKey = process.env.GEMINI_API_KEY;
const sharedSecret = process.env.POLYGLOT_LIVE_SHARED_SECRET || "";
const genai = new GoogleGenAI({
  apiKey: geminiApiKey
});

if (!geminiApiKey) {
  console.error("GEMINI_API_KEY is required.");
  process.exit(1);
}

const server = http.createServer(async (request, response) => {
  try {
    setCorsHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.url === "/status" && request.method === "POST") {
      if (sharedSecret && request.headers["x-polyglot-live-secret"] !== sharedSecret) {
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "Unauthorized." }));
        return;
      }

      const probe = await requestToken({ targetLanguage: "fr" });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          expireTime: probe.expireTime,
          ok: true,
          sharedSecretRequired: Boolean(sharedSecret)
        })
      );
      return;
    }

    if (request.url !== "/token") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Not found." }));
      return;
    }

    if (request.method !== "POST") {
      response.writeHead(405, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Use POST /token." }));
      return;
    }

    if (sharedSecret && request.headers["x-polyglot-live-secret"] !== sharedSecret) {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Unauthorized." }));
      return;
    }

    const requestBody = await readJsonBody(request);
    const tokenResponse = await requestToken(requestBody);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        expireTime: tokenResponse.authToken?.expireTime || tokenResponse.expireTime || null,
        newSessionExpireTime:
          tokenResponse.authToken?.newSessionExpireTime || tokenResponse.newSessionExpireTime || null,
        token: tokenResponse.authToken?.name || tokenResponse.name || null
      })
    );
  } catch (error) {
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(port, host, () => {
  console.log(`polyglot-live token server listening at http://${host}:${port}/token`);
  console.log(`polyglot-live readiness probe available at http://${host}:${port}/status`);
});

function setCorsHeaders(response) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "POST, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type, x-polyglot-live-secret");
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON body."));
      }
    });

    request.on("error", reject);
  });
}

async function requestToken({ targetLanguage = "en" } = {}) {
  const now = Date.now();
  const expireTime = new Date(now + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(now + 60 * 1000).toISOString();
  try {
    const token = await genai.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        liveConnectConstraints: {
          model: GEMINI_MODEL,
          config: {
            responseModalities: ["AUDIO"],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            translationConfig: {
              targetLanguageCode: targetLanguage,
              echoTargetLanguage: true
            }
          }
        },
        lockAdditionalFields: [],
        httpOptions: {
          apiVersion: "v1alpha"
        }
      }
    });

    console.log(`polyglot-live token provisioning succeeded via @google/genai (${targetLanguage})`);
    return token;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini token provisioning failed via @google/genai: ${message}`);
  }
}
