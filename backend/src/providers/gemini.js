export async function callGeminiJson({ systemPrompt, input, geminiApiKey, model = "gemini-3.5-flash-lite" }) {
  if (!geminiApiKey) throw new Error("GEMINI_API_KEY is not set. Add it to .env; never place it in source code.");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify(input, null, 2) }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${detail.slice(0, 300)}`);
  }

  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");

  try {
    const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
      return JSON.parse(normalized);
    } catch {
      const start = normalized.indexOf("{");
      const end = normalized.lastIndexOf("}");
      if (start < 0 || end <= start) throw new Error("No JSON object found");
      return JSON.parse(normalized.slice(start, end + 1));
    }
  } catch {
    throw new Error("Gemini output was not valid JSON");
  }
}
