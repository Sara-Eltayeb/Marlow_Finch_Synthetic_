const apiBase = new URLSearchParams(location.search).get("api") || window.MARLOW_FINCH_API || "http://localhost:8787";
const select = document.querySelector("#user-select");
const runButton = document.querySelector("#run-button");
const status = document.querySelector("#status");
const dashboard = document.querySelector("#dashboard");

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
    select.innerHTML = result.users.map((user) => `<option value="${user.User_ID}">${user.User_ID} · ${user.Goal_Type} · ${user.Goal_Status}</option>`).join("");
    runButton.disabled = false;
    setStatus("Select a customer to run the five-agent review.");
  } catch {
    select.innerHTML = "<option>Backend not connected</option>";
    setStatus("Backend not connected. Start the backend locally or open this page with ?api=YOUR_BACKEND_URL.", true);
  }
}

function render(run) {
  const user = run.input.selected.user;
  const research = run.researcher_output;
  const strategy = run.designer_output;
  const currency = run.input.currency;
  const manager = run.manager_output;
  const message = run.marketer_output;
  const percent = Number.parseFloat(user["Goal_Progress_%"]) || 0;
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
  text("#trend-title", `${user.Logins_Last_7_Days} logins in 7 days`);
  text("#trend-caption", `${user.Logins_Last_30_Days} logins in 30 days versus a previous weekly average of ${user.Previous_Weekly_Login_Avg}. This is evidence of reduced activity, not a diagnosis of intent.`);
  text("#engagement-pattern", strategy.strategy_type.replaceAll("_", " / "));
  text("#recommended-action", strategy.overview);
  text("#recommended-channel", strategy.channel_guidance);
  text("#recommended-time", strategy.timing_guidance);
  text("#goal-name", user.Goal_Type);
  text("#goal-target", `${user.Goal_Target} ${user.Goal_Currency}`);
  text("#goal-amount", `${user.Goal_Current_Value} ${user.Goal_Currency} / ${user.Goal_Target} ${user.Goal_Currency}`);
  text("#goal-currency", user.Goal_Currency);
  document.querySelector("#goal-progress").style.width = `${Math.min(percent, 100)}%`;
  text("#goal-status", user.Goal_Status);
  text("#from-currency", user.Region_Currency);
  text("#to-currency", user.Goal_Currency);
  text("#rate-value", currency.required ? `${currency.rate.base}/${currency.rate.quote} ${currency.rate.rate}` : "Not required");
  text("#rate-date", currency.required ? currency.rate.date : "Not required");
  text("#decision", manager.final_decision);
  text("#decision-rationale", manager.decision_rationale);
  text("#next-step", manager.required_next_step);
  text("#message-channel", message.channel);
  text("#message-headline", message.headline);
  text("#message-body", message.message);
  text("#message-cta", message.cta);
  text("#run-id", `Run ${run.run_id}`);
  text("#run-date", new Date(run.completed_at).toLocaleString());
  dashboard.classList.remove("hidden");
}

runButton.addEventListener("click", async () => {
  runButton.disabled = true;
  dashboard.classList.add("hidden");
  setStatus("Running Researcher, Designer, Maker, Marketer, and Manager in sequence...");
  try {
    const response = await fetch(`${apiBase}/api/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: select.value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Workflow failed");
    render(result);
    setStatus("Five-agent review complete. No communication was sent.");
  } catch (error) { setStatus(error.message, true); }
  runButton.disabled = false;
});

loadUsers();
