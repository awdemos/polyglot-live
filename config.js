export const GEMINI_MODEL = "gemini-3.5-live-translate-preview";
export const INPUT_SAMPLE_RATE = 16000;
export const OUTPUT_SAMPLE_RATE = 24000;
export const CHUNK_DURATION_MS = 100;
export const INPUT_SAMPLES_PER_CHUNK = (INPUT_SAMPLE_RATE * CHUNK_DURATION_MS) / 1000;
export const DEFAULT_TOKEN_ENDPOINT = "http://127.0.0.1:8787/token";
export const LIVE_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";
export const DEFAULT_TARGET_LANGUAGE_CODE = "es";
export const DEFAULT_INPUT_SOURCE = "tab";
export const DEFAULT_SOURCE_MEDIA_RESUME_DELAY_SECONDS = 5;
export const DEFAULT_ORIGINAL_AUDIO_MIX_PERCENT = 0;
export const LIVE_TRANSLATE_AUDIO_INPUT_COST_PER_MINUTE_USD = 0.0053;
export const LIVE_TRANSLATE_AUDIO_OUTPUT_COST_PER_MINUTE_USD = 0.0315;
export const LIVE_TRANSLATE_ESTIMATED_COST_PER_MINUTE_USD =
  LIVE_TRANSLATE_AUDIO_INPUT_COST_PER_MINUTE_USD + LIVE_TRANSLATE_AUDIO_OUTPUT_COST_PER_MINUTE_USD;
export const SUPPORTED_INPUT_SOURCES = [
  { value: "tab", label: "Tab audio" },
  { value: "microphone", label: "Microphone" }
];
export const RTL_LANGUAGE_CODES = ["ar", "fa", "he", "sd", "ur"];
export const SUPPORTED_TRANSLATION_LANGUAGES = [
  { code: "af", label: "Afrikaans" },
  { code: "ak", label: "Akan" },
  { code: "sq", label: "Albanian" },
  { code: "am", label: "Amharic" },
  { code: "ar", label: "Arabic" },
  { code: "hy", label: "Armenian" },
  { code: "az", label: "Azerbaijani" },
  { code: "eu", label: "Basque" },
  { code: "be", label: "Belarusian" },
  { code: "bn", label: "Bengali" },
  { code: "bg", label: "Bulgarian" },
  { code: "my", label: "Burmese (Myanmar)" },
  { code: "ca", label: "Catalan" },
  { code: "zh-Hans", label: "Chinese (Simplified)" },
  { code: "zh-Hant", label: "Chinese (Traditional)" },
  { code: "hr", label: "Croatian" },
  { code: "cs", label: "Czech" },
  { code: "da", label: "Danish" },
  { code: "nl", label: "Dutch" },
  { code: "en", label: "English" },
  { code: "et", label: "Estonian" },
  { code: "fil", label: "Filipino" },
  { code: "fi", label: "Finnish" },
  { code: "fr", label: "French" },
  { code: "gl", label: "Galician" },
  { code: "ka", label: "Georgian" },
  { code: "de", label: "German" },
  { code: "el", label: "Greek" },
  { code: "gu", label: "Gujarati" },
  { code: "ha", label: "Hausa" },
  { code: "he", label: "Hebrew" },
  { code: "hi", label: "Hindi" },
  { code: "hu", label: "Hungarian" },
  { code: "is", label: "Icelandic" },
  { code: "id", label: "Indonesian" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "jv", label: "Javanese" },
  { code: "kn", label: "Kannada" },
  { code: "kk", label: "Kazakh" },
  { code: "km", label: "Khmer" },
  { code: "rw", label: "Kinyarwanda" },
  { code: "ko", label: "Korean" },
  { code: "lo", label: "Lao" },
  { code: "lv", label: "Latvian" },
  { code: "lt", label: "Lithuanian" },
  { code: "mk", label: "Macedonian" },
  { code: "ms", label: "Malay" },
  { code: "ml", label: "Malayalam" },
  { code: "mr", label: "Marathi" },
  { code: "mn", label: "Mongolian" },
  { code: "ne", label: "Nepali" },
  { code: "no", label: "Norwegian" },
  { code: "fa", label: "Persian" },
  { code: "pl", label: "Polish" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "pt-PT", label: "Portuguese (Portugal)" },
  { code: "pa", label: "Punjabi" },
  { code: "ro", label: "Romanian" },
  { code: "ru", label: "Russian" },
  { code: "sr", label: "Serbian" },
  { code: "sd", label: "Sindhi" },
  { code: "si", label: "Sinhala" },
  { code: "sk", label: "Slovak" },
  { code: "sl", label: "Slovenian" },
  { code: "es", label: "Spanish" },
  { code: "su", label: "Sundanese" },
  { code: "sw", label: "Swahili" },
  { code: "sv", label: "Swedish" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "th", label: "Thai" },
  { code: "tr", label: "Turkish" },
  { code: "uk", label: "Ukrainian" },
  { code: "ur", label: "Urdu" },
  { code: "uz", label: "Uzbek" },
  { code: "vi", label: "Vietnamese" },
  { code: "zu", label: "Zulu" }
];
