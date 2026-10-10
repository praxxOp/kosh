// Fallback narration: Edge neural TTS (free). Same outputs as tts.mjs (audio/<id>.wav) so build.mjs is unchanged.
import { createWriteStream, mkdirSync, readFileSync, existsSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const here = path.dirname(fileURLToPath(import.meta.url));
const VOICE = process.env.TTS_VOICE ?? "en-US-AndrewMultilingualNeural";
const RATE = process.env.TTS_RATE ?? "+6%";
const scenes = JSON.parse(readFileSync(path.join(here, "script.json"), "utf8"));
mkdirSync(path.join(here, "audio"), { recursive: true });

// Spell out the things a TTS voice gets wrong.
const speakable = (t) => t.replaceAll("AgntID", "Agent-I-D").replaceAll("ETFs", "E-T-Fs").replaceAll("CFO", "C-F-O");
const dur = (f) => Number(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${f}"`).toString().trim());

const tts = new MsEdgeTTS();
await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

let total = 0;
for (const s of scenes) {
  const mp3 = path.join(here, "audio", `${s.id}.mp3`);
  const wav = path.join(here, "audio", `${s.id}.wav`);
  const r = tts.toStream(speakable(s.text), { rate: RATE });
  const stream = r.audioStream ?? r;
  await new Promise((res, rej) => stream.pipe(createWriteStream(mp3)).on("finish", res).on("error", rej));
  if (existsSync(wav)) unlinkSync(wav);
  execSync(`ffmpeg -v error -y -i "${mp3}" -ar 48000 -ac 2 "${wav}"`);
  unlinkSync(mp3);
  const d = dur(wav);
  total += d;
  console.log(`${s.id}: ${d.toFixed(1)}s`);
}
console.log(`total narration: ${total.toFixed(1)}s (voice ${VOICE}, rate ${RATE})`);
