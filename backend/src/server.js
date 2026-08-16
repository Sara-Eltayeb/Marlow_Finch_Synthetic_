import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fetchRelevantCurrency, fetchSelectedUser, fetchUsers, fetchWeeklyActivity } from "./data/live-data.js";
import { runResearcher } from "./agents/researcher.js";
import { runDesigner } from "./agents/designer.js";
import { runMaker } from "./agents/maker.js";
import { runMarketer } from "./agents/marketer.js";
import { runManager } from "./agents/manager.js";

const dataUrl = process.env.GOOGLE_SHEETS_USER_DATA_URL
  ?? "https://docs.google.com/spreadsheets/d/e/2PACX-1vTOWK-CxODEnX356-osN_6SXoM0xbaIxengfFut5QPE8Kx9d81VKGcWsErHGJkqSaIp4_0nNcdD3-GI/pub?output=csv";
const rateUrl = process.env.FRANKFURTER_RATE_URL ?? "https://api.frankfurter.dev/v2/rate/EUR/USD";
const weeklyDataUrl = process.env.WEEKLY_ACTIVITY_DATA_URL
  ?? "https://docs.google.com/spreadsheets/d/e/2PACX-1vTOWK-CxODEnX356-osN_6SXoM0xbaIxengfFut5QPE8Kx9d81VKGcWsErHGJkqSaIp4_0nNcdD3-GI/pub?gid=137332701&single=true&output=csv";
const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const port = Number(process.env.PORT ?? 8787);
const origin = process.env.FRONTEND_ORIGIN ?? "*";

function send(response, status, body) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

async function runWorkflow(userId) {
  const runId = randomUUID();
  const selected = await fetchSelectedUser({ dataUrl, userId });
  const currency = await fetchRelevantCurrency({ user: selected.user, rateUrl });
  let weeklyActivity;
  try {
    weeklyActivity = await fetchWeeklyActivity({ weeklyDataUrl, userId });
  } catch (error) {
    weeklyActivity = { available: false, error: error.message, selectedUserId: userId, rows: [] };
  }
  const researchBrief = await runResearcher({ user: selected.user, currency, weeklyActivity, geminiApiKey: process.env.GEMINI_API_KEY, model });
  const strategy = await runDesigner({ researchBrief, geminiApiKey: process.env.GEMINI_API_KEY, model });
  const interventionPlan = await runMaker({ researchBrief, strategy, geminiApiKey: process.env.GEMINI_API_KEY, model });
  const communication = await runMarketer({ interventionPlan, researchBrief, geminiApiKey: process.env.GEMINI_API_KEY, model });
  const manager = await runManager({ researchBrief, strategy, interventionPlan, communication, geminiApiKey: process.env.GEMINI_API_KEY, model });
  const run = {
    run_id: runId,
    selected_user_id: userId,
    input: { selected, currency },
    weekly_activity: weeklyActivity,
    researcher_output: researchBrief,
    designer_output: strategy,
    maker_output: interventionPlan,
    marketer_output: communication,
    manager_output: manager,
    completed_at: new Date().toISOString(),
  };
  await mkdir("evidence-runs", { recursive: true });
  await writeFile(`evidence-runs/${runId}-manager.json`, `${JSON.stringify(run, null, 2)}\n`);
  return run;
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") return send(response, 204, {});
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (request.method === "GET" && url.pathname === "/api/health") return send(response, 200, { ok: true, model });
    if (request.method === "GET" && url.pathname === "/api/users") {
      const result = await fetchUsers({ dataUrl });
      return send(response, 200, { source: result.source, users: result.users.map(({ User_ID, Goal_Type, Goal_Status, Preferred_Channel, ["Goal_Progress_%"]: Goal_Progress }) => ({ User_ID, Goal_Type, Goal_Status, Preferred_Channel, "Goal_Progress_%": Goal_Progress })) });
    }
    if (request.method === "GET" && url.pathname === "/api/weekly") {
      const userId = url.searchParams.get("userId");
      if (!userId) return send(response, 400, { error: "userId is required" });
      try {
        return send(response, 200, await fetchWeeklyActivity({ weeklyDataUrl, userId }));
      } catch (error) {
        return send(response, 200, { available: false, error: error.message, selectedUserId: userId, rows: [] });
      }
    }
    if (request.method === "GET" && url.pathname === "/api/context") {
      const userId = url.searchParams.get("userId");
      if (!userId) return send(response, 400, { error: "userId is required" });
      const selected = await fetchSelectedUser({ dataUrl, userId });
      const currency = await fetchRelevantCurrency({ user: selected.user, rateUrl });
      return send(response, 200, { selected, currency });
    }
    if (request.method === "POST" && url.pathname === "/api/run") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const input = JSON.parse(Buffer.concat(chunks).toString() || "{}");
      if (!input.userId) return send(response, 400, { error: "userId is required" });
      return send(response, 200, await runWorkflow(input.userId));
    }
    return send(response, 404, { error: "Not found" });
  } catch (error) {
    return send(response, 500, { error: error.message });
  }
});

server.listen(port, () => console.log(`Marlow & Finch backend listening on http://localhost:${port}`));
