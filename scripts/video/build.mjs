// Assembles the submission video: each scene is fitted to its narration, captioned, then concatenated.
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? "C:/Users/shelk/OneDrive/Desktop/devfolio-hack/kosh-submission.mp4";
const scenes = JSON.parse(readFileSync(path.join(here, "script.json"), "utf8"));
mkdirSync(path.join(here, "out"), { recursive: true });

const sh = (cmd) => execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString();
const dur = (f) => Number(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${f}"`).trim());
const FONT = "C\\:/Windows/Fonts/segoeui.ttf";
const ENC = `-c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -r 30 -c:a aac -b:a 160k -ar 48000 -ac 2`;
const GAP = 0.8; // breathing room after each narration
const LEAD = 0.5; // narration starts this long after the picture

const parts = [];
let total = 0;
for (const s of scenes) {
  const narr = path.join(here, "audio", `${s.id}.wav`);
  if (!existsSync(narr)) throw new Error(`missing narration ${narr}`);
  const target = +(dur(narr) + LEAD + GAP).toFixed(2);
  const out = path.join(here, "out", `${s.id}.mp4`);
  const card = path.join(here, "cards", `${s.id}.png`);
  const clip = path.join(here, "scenes", `${s.id}.webm`);
  const audio = `[1:a]adelay=${Math.round(LEAD * 1000)}|${Math.round(LEAD * 1000)},apad=whole_dur=${target},loudnorm=I=-16:TP=-1.5:LRA=11[a]`;

  if (existsSync(card)) {
    const fadeOut = (target - 0.7).toFixed(2);
    sh(
      `ffmpeg -v error -y -loop 1 -framerate 30 -i "${card}" -i "${narr}" -filter_complex "[0:v]scale=1280:720,fade=t=in:st=0:d=0.7,fade=t=out:st=${fadeOut}:d=0.7,format=yuv420p[v];${audio}" -map "[v]" -map "[a]" -t ${target} ${ENC} "${out}"`
    );
  } else {
    if (!existsSync(clip)) throw new Error(`missing scene ${clip}`);
    const have = dur(clip);
    // Longer than the narration: speed the picture up to fit. Shorter: hold the last frame.
    const factor = have > target ? have / target : 1;
    const hold = have < target ? `,tpad=stop_mode=clone:stop_duration=${(target - have + 0.5).toFixed(2)}` : "";
    const caption = `drawtext=fontfile='${FONT}':text='${s.title.replace(/'/g, "")}':fontsize=22:fontcolor=white@0.92:x=(w-text_w)/2:y=h-44:box=1:boxcolor=black@0.55:boxborderw=10`;
    sh(
      `ffmpeg -v error -y -i "${clip}" -i "${narr}" -filter_complex "[0:v]setpts=PTS/${factor.toFixed(4)},scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2${hold},fps=30,${caption},fade=t=in:st=0:d=0.4,format=yuv420p[v];${audio}" -map "[v]" -map "[a]" -t ${target} ${ENC} "${out}"`
    );
    console.log(`${s.id}: clip ${have.toFixed(1)}s → ${target}s (${factor > 1 ? factor.toFixed(2) + "x faster" : "held"})`);
  }
  const d = dur(out);
  total += d;
  parts.push(out);
  console.log(`${s.id}: ${d.toFixed(1)}s`);
}

const list = path.join(here, "out", "list.txt");
writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
sh(`ffmpeg -v error -y -f concat -safe 0 -i "${list}" -c copy "${OUT}"`);
const final = dur(OUT);
console.log(`\n${OUT}\n${final.toFixed(1)}s total (${final < 120 ? "under" : "OVER"} 2:00), ${(statSync(OUT).size / 1e6).toFixed(1)} MB`);
