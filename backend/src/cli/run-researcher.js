import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fetchRelevantCurrency, fetchSelectedUser } from "../data/live-data.js";
import { runResearcher } from "../agents/researcher.js";

const dataUrl = process.env.GOOGLE_SHEETS_USER_DATA_URL
  ?? "https://docs.google.com/spreadsheets/d/e/2PACX-1vTOWK-CxODEnX356-osN_6SXoM0xbaIxengfFut5QPE8Kx9d81VKGcWsErHGJkqSaIp4_0nNcdD3-GI/pub?output=csv";
const rateUrl = process.env.FRANKFURTER_RATE_URL
  ?? "https://api.frankfurter.dev/v2/rate/EUR/USD";
const userId = process.env.SELECTED_USER_ID ?? process.argv[2] ?? "MF001";
const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const runId = randomUUID();
const startedAt = new Date().toISOString();

const run = {
  run_id: runId,
  phase: "researcher",
  started_at: startedAt,
  selected_user_id: userId,
  status: "started",
};

try {
  const selected = await fetchSelectedUser({ dataUrl, userId });
  const currency = await fetchRelevantCurrency({ user: selected.user, rateUrl });
  run.input = { selected, currency };

  console.log("RESEARCHER");
  console.log("INPUT:");
  console.log(JSON.stringify(run.input, null, 2));

  const brief = await runResearcher({
    user: selected.user,
    currency,
    geminiApiKey: process.env.GEMINI_API_KEY,
    model,
  });

  run.output = brief;
  run.status = "completed";
  run.completed_at = new Date().toISOString();

  console.log("OUTPUT:");
  console.log(JSON.stringify(brief, null, 2));
  console.log("HANDOFF -> DESIGNER");
} catch (error) {
  run.status = "failed";
  run.error = error.message;
  run.completed_at = new Date().toISOString();
  console.error(`Researcher phase failed: ${error.message}`);
  process.exitCode = 1;
}

await mkdir("evidence-runs", { recursive: true });
await writeFile(`evidence-runs/${runId}-researcher.json`, `${JSON.stringify(run, null, 2)}\n`);
