// Narration via OpenRouter's audio-output chat models (openai/gpt-audio-mini).
// Reads script.json, writes audio/<id>.wav, prints each clip's duration.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = readFileSync("C:/Users/shelk/OneDrive/Desktop/devfolio-hack/kosh/.env.local", "utf8");
const KEY = env.match(/^OPENROUTER_API_KEY=(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, "");
if (!KEY) throw new Error("OPENROUTER_API_KEY missing");

const MODEL = process.env.TTS_MODEL ?? "openai/gpt-audio-mini";
const VOICE = process.env.TTS_VOICE ?? "cedar";
const scenes = JSON.parse(readFileSync(path.join(here, "script.json"), "utf8"));
const only = process.argv.slice(2);
mkdirSync(path.join(here, "audio"), { recursive: true });

const dur = (f) => Number(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${f}"`).toString().trim());

for (const s of scenes) {
  if (only.length && !only.includes(s.id)) continue;
  const out = path.join(here, "audio", `${s.id}.wav`);
  if (existsSync(out) && !process.env.FORCE) {
    console.log(`${s.id}: cached ${dur(out).toFixed(1)}s`);
    continue;
  }
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://kosh.local", "X-Title": "Kosh narration" },
    body: JSON.stringify({
      model: MODEL,
      modalities: ["text", "audio"],
      audio: { voice: VOICE, format: "wav" },
      messages: [
        {
          role: "system",
          content:
            "You are a professional voice-over artist recording a product video. Read the user's script aloud exactly as written, word for word. Do not add greetings, commentary, or anything that is not in the script. Tone: warm, confident, unhurried but brisk, like a good tech launch video. Pronounce 'Kosh' as 'koash' (rhymes with 'gauche'), 'AgntID' as 'agent I D', and 'ETFs' as 'E T Fs'.",
        },
        { role: "user", content: s.text },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${s.id}: ${res.status} ${await res.text()}`);
  const j = await res.json();
  const b64 = j.choices?.[0]?.message?.audio?.data;
  if (!b64) throw new Error(`${s.id}: no audio in response: ${JSON.stringify(j).slice(0, 400)}`);
  writeFileSync(out, Buffer.from(b64, "base64"));
  console.log(`${s.id}: ${dur(out).toFixed(1)}s  (transcript: ${j.choices[0].message.audio.transcript?.slice(0, 60) ?? "-"}…)`);
}
const total = scenes.filter((s) => existsSync(path.join(here, "audio", `${s.id}.wav`))).reduce((n, s) => n + dur(path.join(here, "audio", `${s.id}.wav`)), 0);
console.log(`total narration: ${total.toFixed(1)}s`);
