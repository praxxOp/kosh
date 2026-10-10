// Records the app scenes with Playwright against the running dev server (localhost:3000).
// Output: scenes/s2.webm, s3.webm, s4.webm and cards/s1.png, s5.png.
import { chromium } from "playwright";
import { mkdirSync, renameSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3000";
const only = process.argv.slice(2);
mkdirSync(path.join(here, "scenes"), { recursive: true });
mkdirSync(path.join(here, "cards"), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();

async function newPage(record) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    recordVideo: record ? { dir: path.join(here, "scenes", "raw"), size: { width: 1280, height: 720 } } : undefined,
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("theme", "dark");
    } catch {}
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  [page error]", e.message));
  return { ctx, page };
}

// Everything the recording needs from the app goes through the dev-only store handle.
const store = (page, fn) => page.evaluate(fn);
const ready = async (page) => {
  await page.waitForFunction(() => window.__kosh, null, { timeout: 30000 });
  await sleep(600);
};
const waitRun = async (page, timeout) => {
  await page.waitForFunction(() => window.__kosh.getState().running, null, { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => !window.__kosh.getState().running, null, { timeout });
};
const smoothScroll = async (page, px, ms) => {
  const steps = Math.max(1, Math.round(ms / 40));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, px / steps);
    await sleep(40);
  }
};

async function scene(id, fn) {
  if (only.length && !only.includes(id)) return;
  console.log(`▶ ${id}`);
  const { ctx, page } = await newPage(true);
  try {
    await fn(page);
  } catch (e) {
    console.log(`  ! ${id}: ${e.message}`);
  }
  const video = page.video();
  await ctx.close();
  const raw = await video.path();
  const out = path.join(here, "scenes", `${id}.webm`);
  if (existsSync(out)) rmSync(out);
  renameSync(raw, out);
  console.log(`  ✓ ${out}`);
}

async function card(id, which) {
  if (only.length && !only.includes(id)) return;
  const { ctx, page } = await newPage(false);
  await page.goto(pathToFileURL(path.join(here, "cards.html")).href);
  // Chromium drops the query on file:// URLs, so pick the card in-page.
  await page.evaluate((w) => {
    for (const el of document.querySelectorAll("section")) el.hidden = el.id !== w;
  }, which);
  await sleep(300);
  await page.screenshot({ path: path.join(here, "cards", `${id}.png`) });
  await ctx.close();
  console.log(`  ✓ card ${id}`);
}

await card("s1", "title");
await card("s5", "close");

// s2 — the treasury manager asks Kosh to invest, guarded. Real agent run.
await scene("s2", async (page) => {
  await page.goto(`${BASE}/dashboard/kosh`);
  await ready(page);
  await store(page, () => {
    const s = window.__kosh.getState();
    s.setRole("treasury_manager");
    s.setMode("on");
    s.clear();
    s.setTab("actions");
  });
  await sleep(1800);
  const box = page.locator("textarea").first();
  await box.click();
  await sleep(400);
  await box.pressSequentially("We have spare cash. Invest it safely per policy.", { delay: 32 });
  await sleep(500);
  await box.press("Enter");
  await sleep(1500);
  if (!(await store(page, () => window.__kosh.getState().running))) await page.locator('[aria-label="Send"]').first().click();
  await waitRun(page, 170000);
  await sleep(3500);
});

// s3 — guard off: the scripted attack goes through. Guard on: every step blocked. Then the audit log.
await scene("s3", async (page) => {
  await page.goto(`${BASE}/dashboard/kosh`);
  await ready(page);
  await store(page, () => {
    const s = window.__kosh.getState();
    s.setRole("treasury_manager");
    s.setMode("off");
    s.clear();
  });
  await sleep(1200);
  await store(page, () => void window.__kosh.getState().replay());
  await waitRun(page, 120000);
  await sleep(2200);
  await store(page, () => {
    const s = window.__kosh.getState();
    s.setMode("on");
    s.clear();
  });
  await sleep(900);
  await store(page, () => void window.__kosh.getState().replay());
  await waitRun(page, 120000);
  await sleep(2500);
  await page.goto(`${BASE}/dashboard/kosh/audit`);
  await sleep(2500);
  await smoothScroll(page, 420, 2200);
  await sleep(1800);
});

// s4 — the policy, then the approval chain: the analyst sends a held order up, the manager approves it.
// Needs an analyst draft to exist; the guarded scenario replay creates one (off camera) if there is none.
if (!only.length || only.includes("s4")) {
  const approvals = await (await fetch(`${BASE}/api/approvals`)).json();
  if (!approvals.some((a) => a.status === "draft" && a.requestedBy === "analyst")) {
    console.log("  (prep) creating an analyst draft via the guarded scenario replay");
    const { ctx, page } = await newPage(false);
    await page.goto(`${BASE}/dashboard/kosh`);
    await ready(page);
    await store(page, () => {
      const s = window.__kosh.getState();
      s.setRole("treasury_manager");
      s.setMode("on");
      s.clear();
      void s.replay();
    });
    await waitRun(page, 120000);
    await ctx.close();
  }
}
await scene("s4", async (page) => {
  await page.goto(`${BASE}/dashboard/kosh/policy`);
  await sleep(2000);
  await smoothScroll(page, 520, 2800);
  await sleep(1200);
  await page.goto(`${BASE}/dashboard/kosh`);
  await ready(page);
  await store(page, () => {
    const s = window.__kosh.getState();
    s.setMode("on");
    s.setRole("analyst");
    s.setTab("actions");
    void s.loadApprovals();
  });
  await sleep(2000);
  const sendUp = page.getByRole("button", { name: /^Send to/ }).first();
  if (await sendUp.count()) {
    await sendUp.hover();
    await sleep(500);
    await sendUp.click();
    await sleep(2200);
  } else console.log("  (no analyst proposal to send)");
  await store(page, () => {
    const s = window.__kosh.getState();
    s.setRole("treasury_manager");
    s.setTab("actions");
  });
  await sleep(2200);
  const approve = page.getByRole("button", { name: "Approve", exact: true }).first();
  if (await approve.count()) {
    await approve.hover();
    await sleep(600);
    await approve.click();
    await sleep(3500);
  } else {
    console.log("  (no pending approval to approve)");
    await sleep(2500);
  }
});

await browser.close();
// A partial run (node record.mjs s4) may be running beside a full one; only a full run sweeps the raw dir.
if (!only.length) rmSync(path.join(here, "scenes", "raw"), { recursive: true, force: true });
console.log("done");
