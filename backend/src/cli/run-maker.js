import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fetchRelevantCurrency, fetchSelectedUser } from "../data/live-data.js";
import { runResearcher } from "../agents/researcher.js";
import { runDesigner } from "../agents/designer.js";
import { runMaker } from "../agents/maker.js";

const dataUrl = process.env.GOOGLE_SHEETS_USER_DATA_URL
  ?? "https://docs.google.com/spreadsheets/d/e/2PACX-1vTOWK-CxODEnX356-osN_6SXoM0xbaIxengfFut5QPE8Kx9d81VKGcWsErHGJkqSaIp4_0nNcdD3-GI/pub?output=csv";
const rateUrl = process.env.FRANKFURTER_RATE_URL
  ?? "https://api.frankfurter.dev/v2/rate/EUR/USD";
const userId = process.env.SELECTED_USER_ID ?? process.argv[2] ?? "MF001";
const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const runId = randomUUID();
const run = { run_id: runId, phase: "maker", selected_user_id: userId, status: "started" };

try {
  const selected = await fetchSelectedUser({ dataUrl, userId });
  const currency = await fetchRelevantCurrency({ user: selected.user, rateUrl });
  run.input = { selected, currency };

  console.log("RESEARCHER");
  console.log("INPUT:");
  console.log(JSON.stringify(run.input, null, 2));
  const researchBrief = await runResearcher({ user: selected.user, currency, geminiApiKey: process.env.GEMINI_API_KEY, model });
  run.researcher_output = researchBrief;
  console.log("OUTPUT:");
  console.log(JSON.stringify(researchBrief, null, 2));
  console.log("HANDOFF -> DESIGNER");

  console.log("DESIGNER");
  console.log("INPUT FROM RESEARCHER:");
  console.log(JSON.stringify(researchBrief, null, 2));
  const strategy = await runDesigner({ researchBrief, geminiApiKey: process.env.GEMINI_API_KEY, model });
  run.designer_output = strategy;
  console.log("OUTPUT:");
  console.log(JSON.stringify(strategy, null, 2));
  console.log("HANDOFF -> MAKER");

  console.log("MAKER");
  console.log("INPUT FROM RESEARCHER + DESIGNER:");
  console.log(JSON.stringify({ researchBrief, strategy }, null, 2));
  const plan = await runMaker({ researchBrief, strategy, geminiApiKey: process.env.GEMINI_API_KEY, model });
  run.maker_output = plan;
  run.status = "completed";
  run.completed_at = new Date().toISOString();
  console.log("OUTPUT:");
  console.log(JSON.stringify(plan, null, 2));
  console.log("HANDOFF -> MARKETER");
} catch (error) {
  run.status = "failed";
  run.error = error.message;
  run.completed_at = new Date().toISOString();
  console.error(`Maker phase failed: ${error.message}`);
  process.exitCode = 1;
}

await mkdir("evidence-runs", { recursive: true });
await writeFile(`evidence-runs/${runId}-maker.json`, `${JSON.stringify(run, null, 2)}\n`);
