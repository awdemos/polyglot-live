import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const host = process.env.POLYGLOT_LATIN_HOST || "127.0.0.1";
const port = Number(process.env.POLYGLOT_LATIN_PORT || 8788);
const ollamaBaseUrl = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const ollamaModel = process.env.OLLAMA_MODEL || "kimi-k2.7-code:cloud";

async function polishLatin(text) {
  const prompt = `You are a classical Latin expert. Take the following Latin text and correct it to proper classical Latin grammar, vocabulary, and style. If it is already good classical Latin, return it unchanged. Output ONLY the corrected Latin text, with no explanation, no markdown, and no quotation marks.\n\nInput: ${text}\n\nClassical Latin:`;

  const res = await fetch(`${ollamaBaseUrl}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: ollamaModel, prompt, stream: false })
  });

  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const cleaned = (data.response || text)
    .replace(/^\*\*|\*\*$/g, "")
    .replace(/^["']|["']$/g, "")
    .trim();
  return cleaned || text;
}

async function synthesizeLatin(text) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "latin-dub-"));
  const wavPath = path.join(tmpDir, "latin.wav");

  return new Promise((resolve, reject) => {
    const espeak = spawn("espeak-ng", ["-v", "la", text, "-w", wavPath], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stderr = "";
    espeak.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    espeak.on("error", reject);

    espeak.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(`espeak-ng exited ${code}: ${stderr}`));
        return;
      }
      try {
        const wav = await fs.readFile(wavPath);
        await fs.rm(tmpDir, { recursive: true, force: true });
        resolve(wav);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function setCorsHeaders(response) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = http.createServer(async (request, response) => {
  try {
    setCorsHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.url === "/health" && request.method === "GET") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, model: ollamaModel }));
      return;
    }

    if (request.url !== "/speak" || request.method !== "POST") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Not found." }));
      return;
    }

    const body = await readJsonBody(request);
    const rawText = body.text || "";
    const shouldPolish = body.polish !== false;

    if (!rawText.trim()) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Missing text." }));
      return;
    }

    const latinText = shouldPolish ? await polishLatin(rawText) : rawText;
    const wav = await synthesizeLatin(latinText);

    response.writeHead(200, {
      "content-type": "audio/wav",
      "content-length": wav.length,
      "x-latin-text": encodeURIComponent(latinText)
    });
    response.end(wav);
  } catch (error) {
    console.error("[latin-dub] error:", error);
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(port, host, () => {
  console.log(`polyglot-live Latin dub server listening at http://${host}:${port}/speak`);
  console.log(`Using Ollama model ${ollamaModel} at ${ollamaBaseUrl}`);
});
