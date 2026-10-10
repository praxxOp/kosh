# Submission video

Produces `devfolio-hack/kosh-submission.mp4` (~97 s) from the running dev server.

```
cd scripts/video && npm init -y && npm i playwright msedge-tts && npx playwright install chromium
node tts-edge.mjs      # free Edge neural narration  (or: node tts.mjs — OpenRouter gpt-audio-mini, needs ≥$0.50 credit)
node record.mjs        # Playwright records s2–s4 against http://localhost:3000 (real agent run + scenario replays)
node build.mjs         # ffmpeg: fit each scene to its narration, caption, concat → ../../../kosh-submission.mp4
```

`script.json` is the narration; `cards.html` the title/close cards. Recording needs `window.__kosh` (dev-only store handle in `components/kosh/store.ts`).
