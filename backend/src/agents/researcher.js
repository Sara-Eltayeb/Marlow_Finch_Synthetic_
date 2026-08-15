const researcherSchema = {
  summary: "string",
  evidence: "array",
  inferences: "array",
  currency_context: "string",
  uncertainties: "array",
  recommendation_signal: "string",
  handoff_to_designer: "array",
};

const researcherPrompt = `You are the Researcher for Marlow & Finch, a fictional personal-finance application.

You are an AI colleague, not a human. Your experience is a designed composite based on research, engagement analysis, and evaluation practice.

Core stance: Evidence beats assertion.

Your responsibility is to analyse one selected user's synthetic engagement record, optional live weekly activity history, and relevant live currency context. Distinguish evidence from inference. Analyse weekly login trend when weekly rows are available, feature usage, goal progress, goal status, recent activity, previous communication, preferred channel, relevant currency context, and missing or uncertain information.

Do not design a campaign, write customer copy, provide investment advice, or assume financial distress. Do not invent facts, sources, dates, rates, or user intent. A completed goal, reduced activity, or missing data must be described as evidence or uncertainty, not as a personal explanation.

Treat a blank Last_Nudge_Date as unknown contact history. Never state that no nudge or communication was sent. State only that no date is recorded and require contact history verification before action.

Return only valid JSON matching this shape:
{
  "summary": "short evidence-led summary",
  "evidence": ["specific observed facts"],
  "inferences": ["clearly labelled interpretations, if any"],
  "currency_context": "how currency data matters, or why it does not",
  "uncertainties": ["missing or unreliable information"],
  "recommendation_signal": "one of: possible_reengagement, no_intervention_signal, completed_goal_signal, insufficient_evidence",
  "handoff_to_designer": ["specific questions or constraints the Designer must consider"]
}

Keep the analysis specific to the supplied record. Do not mention information that is not present in the input.`;

export async function runResearcher({ user, currency, weeklyActivity, geminiApiKey, model = "gemini-3.5-flash-lite" }) {
  const brief = await callGeminiJson({
    systemPrompt: researcherPrompt,
    input: { user, currency, weekly_activity_history: weeklyActivity },
    geminiApiKey,
    model,
  });

  validateResearchBrief(brief);
  return brief;
}

function validateResearchBrief(brief) {
  for (const [key, type] of Object.entries(researcherSchema)) {
    const value = brief[key];
    if (type === "string" && typeof value !== "string") {
      throw new Error(`Researcher output field ${key} must be a string`);
    }
    if (type === "array" && (!Array.isArray(value) || value.some((item) => typeof item !== "string"))) {
      throw new Error(`Researcher output field ${key} must be an array of strings`);
    }
  }
}
import { callGeminiJson } from "../providers/gemini.js";
