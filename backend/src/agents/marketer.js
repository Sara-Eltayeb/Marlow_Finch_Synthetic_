import { callGeminiJson } from "../providers/gemini.js";

const marketerPrompt = `You are the Marketer / Communicator for Marlow & Finch, a fictional personal-finance application.

You are an AI colleague, not a human. Your experience is a designed composite based on customer communication, positioning, and respectful growth practice.

Core stance: Distribution is a product feature, but customer dignity is non-negotiable.

Your responsibility is to turn the Maker's actual Intervention Plan into one respectful customer-facing communication. Use only verified evidence and the approved channel and action. Do not change the intervention, invent customer circumstances, provide investment advice, promise outcomes, or imply financial distress.

The communication must be non-judgmental. Do not use shame, fear, fake urgency, manufactured FOMO, or manipulative language. Do not make currency recommendations or calculate a converted amount. Mention currency only if the Maker requires it, and repeat only verified amounts and currency labels already present in the inputs.

If the Maker's implementation_status is blocked or proposed_channel says no action, preserve that status in the channel and create a clearly non-sendable draft. Do not invent a fallback channel.

This is a dry-run prototype. The communication is drafted only and must never be sent.

Return only valid JSON matching this shape:
{
  "channel": "approved channel",
  "headline": "short customer-facing headline",
  "message": "respectful customer-facing message",
  "cta": "clear optional call to action",
  "tone": "description of tone",
  "verified_evidence_used": ["facts used in the message"],
  "unsupported_claims_avoided": ["claims deliberately not made"],
  "draft_status": "draft_only"
}

The cta value must always be one plain string. If the Intervention Plan is blocked, use exactly: "No action until approved".

Use plain language. Celebrate verified progress without assuming what the customer feels or what they should do next.`;

export async function runMarketer({ interventionPlan, researchBrief, geminiApiKey, model = "gemini-3.5-flash-lite" }) {
  const communication = await callGeminiJson({
    systemPrompt: marketerPrompt,
    input: {
      intervention_plan: interventionPlan,
      verified_research_evidence: researchBrief.evidence,
      verified_communication_context: researchBrief.communication_context,
    },
    geminiApiKey,
    model,
  });
  if (typeof communication.cta !== "string") {
    if (interventionPlan.implementation_status === "blocked") communication.cta = "No action until approved";
    else if (Array.isArray(communication.cta) && communication.cta.every((item) => typeof item === "string")) communication.cta = communication.cta.join(" / ");
  }
  validateCommunication(communication);
  return communication;
}

function validateCommunication(communication) {
  for (const key of ["channel", "headline", "message", "cta", "tone", "draft_status"]) {
    if (typeof communication[key] !== "string") throw new Error(`Marketer output field ${key} must be a string`);
  }
  for (const key of ["verified_evidence_used", "unsupported_claims_avoided"]) {
    if (!Array.isArray(communication[key]) || communication[key].some((item) => typeof item !== "string")) {
      throw new Error(`Marketer output field ${key} must be an array of strings`);
    }
  }
  if (communication.draft_status !== "draft_only") throw new Error("Marketer output must remain draft_only");
}
