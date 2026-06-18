export const GEMINI_MODEL = "gemini-3.5-live-translate-preview";
export const INPUT_SAMPLE_RATE = 16000;
export const OUTPUT_SAMPLE_RATE = 24000;
export const CHUNK_DURATION_MS = 100;
export const INPUT_SAMPLES_PER_CHUNK = (INPUT_SAMPLE_RATE * CHUNK_DURATION_MS) / 1000;
export const DEFAULT_TOKEN_ENDPOINT = "http://127.0.0.1:8787/token";
export const LIVE_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";
