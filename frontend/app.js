const apiBase = new URLSearchParams(location.search).get("api") || window.MARLOW_FINCH_API || "https://marlow-finch-synthetic.onrender.com";
const select = document.querySelector("#user-select");
const runButton = document.querySelector("#run-button");
const status = document.querySelector("#status");
const dashboard = document.querySelector("#dashboard");
const usersPanel = document.querySelector("#users-panel");
const reportsPanel = document.querySelector("#reports-panel");
let lastRun = null;
let weeklyRequest = 0;
let contextRequest = 0;

function setStatus(message, error = false) { status.textContent = message; status.style.color = error ? "#a34d43" : ""; }
function text(id, value) {
  const element = document.querySelector(id);
  if (element) element.textContent = value ?? "";
}

async function loadUsers() {
  try {
    const response = await fetch(`${apiBase}/api/users`);
    if (!response.ok) throw new Error("Backend unavailable");
    const result = await response.json();
    select.innerHTML = result.users.map((user) => `<option value="${user.User_ID}">${user.User_ID} — ${user.Goal_Type} — ${formatProgress(user["Goal_Progress_%"])} complete</option>`).join("");
    document.querySelector("#user-count").textContent = `${result.users.length} synthetic users`;
    document.querySelector("#user-list").innerHTML = result.users.map((user) => `<tr><td><strong>${user.User_ID}</strong></td><td>${user.Goal_Type}</td><td><span class="table-status">${user.Goal_Status}</span></td><td>${user.Preferred_Channel}</td><td><button class="table-select" data-user="${user.User_ID}">Review →</button></td></tr>`).join("");
    document.querySelectorAll(".table-select").forEach((button) => button.addEventListener("click", () => { select.value = button.dataset.user; loadSelectedUser(select.value); showView("dashboard"); runButton.focus(); }));
    runButton.disabled = false;
    text("#live-status", "Live Data Connected");
    document.querySelector("#live-dot")?.classList.remove("connection-failed");
    setStatus("Select a customer to generate an engagement recommendation.");
    await loadSelectedUser(select.value);
    showView("dashboard");
  } catch {
    select.innerHTML = "<option>Backend not connected</option>";
    text("#live-status", "Live Data Unavailable");
    document.querySelector("#live-dot")?.classList.add("connection-failed");
    setStatus("Backend not connected. Start the backend locally or open this page with ?api=YOUR_BACKEND_URL.", true);
  }
}

function formatProgress(value) {
  const progress = Number.parseFloat(String(value).replace("%", ""));
  return Number.isFinite(progress) ? `${Number.isInteger(progress) ? progress : progress.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%` : "Progress unavailable";
}

async function loadSelectedUser(userId) {
  const requestId = ++contextRequest;
  const weeklyPromise = loadWeeklyChart(userId);
  try {
    const response = await fetch(`${apiBase}/api/context?userId=${encodeURIComponent(userId)}`);
    if (!response.ok) throw new Error("Unable to load selected user");
    const context = await response.json();
    if (requestId !== contextRequest) return;
    renderSelectedUser(context.selected, context.currency);
    await weeklyPromise;
  } catch (error) {
    if (requestId === contextRequest) setStatus(error.message, true);
  }
}

function renderSelectedUser(selected, currency) {
  const user = selected.user;
  const percent = Number.parseFloat(user["Goal_Progress_%"]) || 0;
  const lastActivity = user.Last_Activity_Date ? new Date(user.Last_Activity_Date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Not recorded";
  text("#header-date", new Date(user.Observation_Date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }));
  text("#profile-id", user.User_ID);
  text("#profile-badge", user.Goal_Status === "Completed" ? "Goal Completed" : user.Goal_Status);
  text("#member-since", `${user.Weeks_Since_Signup} weeks`);
  text("#profile-region", user.Region_Currency);
  text("#profile-channel", user.Preferred_Channel);
  text("#profile-activity", `${lastActivity} (${user.Days_Since_Last_Activity} days ago)`);
  text("#profile-nudge", user.Last_Nudge_Date || "Not recorded");
  text("#goal-name", user.Goal_Type);
  text("#goal-target", `${user.Goal_Target} ${user.Goal_Currency}`);
  text("#goal-amount", `${user.Goal_Current_Value} ${user.Goal_Currency} / ${user.Goal_Target} ${user.Goal_Currency}`);
  text("#goal-currency", user.Goal_Currency);
  document.querySelector("#goal-progress").style.width = `${Math.min(percent, 100)}%`;
  text("#goal-status", user.Goal_Status);
  text("#trend-title", "Weekly activity history");
  text("#trend-caption", `${user.Logins_Last_30_Days} logins in 30 days versus a previous weekly average of ${user.Previous_Weekly_Login_Avg}. This is evidence of reduced activity, not a diagnosis of intent.`);
  text("#sheets-status", "Connected");
  text("#sheets-rows", selected.source.rowsRetrieved);
  text("#sheets-user", user.User_ID);
  text("#sheets-refresh", new Date(selected.source.fetchedAt).toLocaleString());
  text("#rate-value", currency.required ? `${currency.rate.base}/${currency.rate.quote} ${currency.rate.rate}` : "Not required");
  text("#regional-equivalent", currency.required && currency.regional_equivalent !== null ? `${currency.regional_equivalent.toFixed(2)} ${currency.regional_currency}` : "Not required");
  text("#rate-date", currency.required ? currency.rate.date : "Not required");
  text("#frankfurter-status", currency.required ? "Connected" : "Not Required");
  text("#currency-context", currency.required ? `${currency.context}. Context only; exchange rates fluctuate.` : "No conversion is needed because goal and regional currencies match.");
  lastRun = null;
  ["engagement-pattern", "recommended-action", "recommendation-reason", "recommended-channel", "recommended-time", "decision", "decision-rationale", "next-step", "message-channel", "message-headline", "message-body", "message-cta"].forEach((id) => text(`#${id}`, "--"));
  setTrailPending();
  document.querySelector("#message-cta").disabled = true;
  document.querySelector("#report-empty").classList.remove("hidden");
  document.querySelector("#report-content").classList.add("hidden");
}

function setTrailPending() {
  const pending = {
    researcher: "Awaits a completed review.",
    designer: "Awaits evidence from Researcher.",
    maker: "Awaits an approved strategy.",
    marketer: "Awaits an intervention plan.",
    manager: "Awaits the completed recommendation.",
  };
  Object.entries(pending).forEach(([agent, summary]) => {
    text(`#summary-${agent}`, summary);
    text(`#detail-${agent}`, "No analysis has been generated for this user yet.");
    text(`#agent-${agent}`, "Pending");
  });
}

async function loadWeeklyChart(userId) {
  const requestId = ++weeklyRequest;
  text("#weekly-chart-status", "Loading");
  text("#weekly-status", "Loading");
  try {
    const response = await fetch(`${apiBase}/api/weekly?userId=${encodeURIComponent(userId)}`);
    const history = await response.json();
    if (requestId === weeklyRequest) renderWeeklyChart(history);
  } catch {
    if (requestId === weeklyRequest) renderWeeklyChart({ available: false, error: "Weekly activity history unavailable." });
  }
}

function renderWeeklyChart(history) {
  const chart = document.querySelector("#weekly-chart");
  const rows = Array.isArray(history.rows) ? history.rows : [];
  text("#weekly-status", history.available ? "Connected" : "Unavailable");
  text("#weekly-rows", history.source ? `${history.source.rowsRetrieved} / ${history.rowsFound}` : "--");
  text("#weekly-chart-status", history.available ? `${rows.length} weeks` : "Unavailable");
  if (!history.available || rows.length === 0) {
    chart.innerHTML = `<div class="chart-unavailable"><strong>Weekly activity history unavailable.</strong><span>${history.error || "No weekly records were found for this user."}</span></div>`;
    return;
  }
  const width = 620;
  const height = 190;
  const left = 42;
  const right = 18;
  const top = 16;
  const bottom = 35;
  const max = Math.max(...rows.map((row) => row.Logins), 1);
  const x = (index) => left + (index * (width - left - right)) / Math.max(rows.length - 1, 1);
  const y = (value) => top + ((max - value) * (height - top - bottom)) / max;
  const points = rows.map((row, index) => `${x(index)},${y(row.Logins)}`).join(" ");
  const labels = rows.map((row, index) => {
    if (rows.length > 12 && index % Math.ceil(rows.length / 8) !== 0 && index !== rows.length - 1) return "";
    return `<text x="${x(index)}" y="${height - 10}" text-anchor="middle">W${row.Week_Number}</text>`;
  }).join("");
  const dots = rows.map((row, index) => `<circle cx="${x(index)}" cy="${y(row.Logins)}" r="3.5"><title>Week ${row.Week_Number}: ${row.Logins} logins</title></circle>`).join("");
  chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Weekly login trend"><line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" /><line class="axis" x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" /><text class="axis-label" x="10" y="${top + 4}">${max}</text><text class="axis-label" x="18" y="${height - bottom + 4}">0</text><polyline class="trend-line" points="${points}" />${dots}${labels}</svg>`;
}

function showView(view) {
  dashboard.classList.toggle("hidden", view !== "dashboard");
  usersPanel.classList.toggle("hidden", view !== "users");
  reportsPanel.classList.toggle("hidden", view !== "reports");
  document.querySelectorAll("nav a").forEach((link) => link.classList.remove("nav-active"));
  document.querySelector(`#${view}-nav`)?.classList.add("nav-active");
  if (view === "reports" && !lastRun) setStatus("Run a review first to generate a report.");
}

function render(run) {
  lastRun = run;
  const user = run.input.selected.user;
  const research = run.researcher_output;
  const strategy = run.designer_output;
  const maker = run.maker_output;
  const currency = run.input.currency;
  const manager = run.manager_output;
  const message = run.marketer_output;
  const percent = Number.parseFloat(user["Goal_Progress_%"]) || 0;
  const sheetSource = run.input.selected.source;
  const formatStrategyType = strategy.strategy_type.replaceAll("_", " ");
  const actionLabels = {
    completed_goal_next_step: "Low-pressure goal progress check-in",
    declining_engagement: "Low-pressure re-engagement check-in",
    no_intervention: "No intervention recommended",
    insufficient_evidence: "Gather more evidence before acting",
  };
  const communicationTitles = {
    SEND: "Approved Communication",
    DELAY: "Communication Preview - Held",
    SUPPRESS: "No Communication Recommended",
    "REVISION REQUIRED": "Draft Returned for Revision",
    INSUFFICIENT_DATA: "No Communication - Insufficient Evidence",
  };
  const observationDate = new Date(user.Observation_Date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const lastActivity = user.Last_Activity_Date ? new Date(user.Last_Activity_Date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Not recorded";
  text("#header-date", observationDate);
  text("#profile-id", user.User_ID);
  text("#profile-badge", user.Goal_Status === "Completed" ? "Goal Completed" : user.Goal_Status);
  text("#member-since", `${user.Weeks_Since_Signup} weeks`);
  text("#profile-region", user.Region_Currency);
  text("#profile-channel", user.Preferred_Channel);
  text("#profile-activity", `${lastActivity} (${user.Days_Since_Last_Activity} days ago)`);
  text("#profile-nudge", user.Last_Nudge_Date || "Not recorded");
  text("#trend-title", run.weekly_activity?.available ? "Weekly activity history" : "Weekly history unavailable");
  text("#trend-caption", `${user.Logins_Last_30_Days} logins in 30 days versus a previous weekly average of ${user.Previous_Weekly_Login_Avg}. This is evidence of reduced activity, not a diagnosis of intent.`);
  text("#engagement-pattern", formatStrategyType);
  text("#recommended-action", actionLabels[strategy.strategy_type] || formatStrategyType);
  text("#recommendation-reason", strategy.why_this_follows_the_evidence?.[0] || research.summary);
  text("#recommended-channel", strategy.channel_guidance);
  text("#recommended-time", strategy.timing_guidance);
  text("#goal-name", user.Goal_Type);
  text("#goal-target", `${user.Goal_Target} ${user.Goal_Currency}`);
  text("#goal-amount", `${user.Goal_Current_Value} ${user.Goal_Currency} / ${user.Goal_Target} ${user.Goal_Currency}`);
  text("#goal-currency", user.Goal_Currency);
  document.querySelector("#goal-progress").style.width = `${Math.min(percent, 100)}%`;
  text("#goal-status", user.Goal_Status);
  text("#sheets-status", "Connected");
  text("#sheets-rows", sheetSource.rowsRetrieved);
  text("#sheets-user", user.User_ID);
  text("#sheets-refresh", new Date(sheetSource.fetchedAt).toLocaleString());
  text("#rate-value", currency.required ? `${currency.rate.base}/${currency.rate.quote} ${currency.rate.rate}` : "Not required");
  text("#regional-equivalent", currency.required && currency.regional_equivalent !== null ? `${currency.regional_equivalent.toFixed(2)} ${currency.regional_currency}` : "Not required");
  text("#rate-date", currency.required ? currency.rate.date : "Not required");
  text("#frankfurter-status", currency.required ? "Connected" : "Not Required");
  text("#currency-context", currency.required ? `${currency.context}. Context only; exchange rates fluctuate.` : "No conversion is needed because goal and regional currencies match.");
  renderWeeklyChart(run.weekly_activity || { available: false });
  text("#decision", manager.final_decision);
  text("#decision-rationale", manager.decision_rationale);
  text("#next-step", manager.required_next_step);
  text("#communication-title", communicationTitles[manager.final_decision] || "Communication Preview");
  text("#message-channel", manager.final_decision === "SEND" ? message.channel : `${message.channel} · held`);
  text("#message-headline", message.headline);
  text("#message-body", message.message);
  text("#message-cta", manager.final_decision === "SEND" ? message.cta : "Preview only");
  document.querySelector("#message-cta").disabled = manager.final_decision !== "SEND";
  text("#run-id", `Run ${run.run_id}`);
  text("#run-date", new Date(run.completed_at).toLocaleString());
  ["researcher", "designer", "maker", "marketer", "manager"].forEach((agent) => text(`#agent-${agent}`, "Completed"));
  text("#summary-researcher", research.summary);
  text("#summary-designer", strategy.overview);
  text("#summary-maker", maker.recommended_action);
  text("#summary-marketer", message.headline);
  text("#summary-manager", `${manager.final_decision}: ${manager.required_next_step}`);
  text("#detail-researcher", research.evidence?.[0] || research.summary);
  text("#detail-designer", strategy.why_this_follows_the_evidence?.[0] || strategy.overview);
  text("#detail-maker", maker.timing);
  text("#detail-marketer", message.message);
  text("#detail-manager", manager.decision_rationale);
  text("#report-decision", manager.final_decision);
  text("#report-user", user.User_ID);
  text("#report-rationale", manager.decision_rationale);
  text("#report-run", run.run_id);
  document.querySelector("#report-empty").classList.add("hidden");
  document.querySelector("#report-content").classList.remove("hidden");
  dashboard.classList.remove("hidden");
}

document.querySelector("#dashboard-nav").addEventListener("click", (event) => { event.preventDefault(); showView("dashboard"); });
document.querySelector("#users-nav").addEventListener("click", (event) => { event.preventDefault(); showView("users"); });
document.querySelector("#reports-nav").addEventListener("click", (event) => { event.preventDefault(); showView("reports"); });
select.addEventListener("change", () => loadSelectedUser(select.value));

runButton.addEventListener("click", async () => {
  runButton.disabled = true;
  dashboard.classList.add("hidden");
  setStatus("Running Researcher, Designer, Maker, Marketer, and Manager in sequence...");
  try {
    const response = await fetch(`${apiBase}/api/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: select.value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Workflow failed");
    render(result);
    setStatus(`Five-agent review complete. Manager decision: ${result.manager_output.final_decision}. Recommendation preview generated; no external action was triggered.`);
  } catch (error) { setStatus(error.message, true); }
  runButton.disabled = false;
});

loadUsers();
