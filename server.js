import "dotenv/config";
import express from "express";
import path from "path";
import {fileURLToPath} from "url";
const app = express();
app.use(express.json({limit: "60kb"}));
const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");

const SYSTEM = `You are ExplainMirror, a kind tutor for school students. You analyse how a student THINKS from their own written explanation. Rules:
- Never give the full correct answer or a model explanation. Point at gaps, guide with questions.
- Judge only what is written. If the text is short, vague or you are unsure, say so and lower your certainty.
- Use simple words a 13-year-old understands. Be specific, quote or refer to the student's own words.
- Reply ONLY with JSON: {"level":"Strong"|"Developing"|"Early"|"Unclear","score":0-100,"certainty":"high"|"medium"|"low","assessment":string,"uncertaintyNote":string,"gaps":[string],"weaknesses":[string],"suggestions":[string],"thoughtQuestion":string,"followUp":string,"challengeReply":string}
- gaps, weaknesses, suggestions: 1-4 short items each. challengeReply is "" unless the student disagreed; then reply honestly: concede if they have a fair point, otherwise explain why, and update the other fields.`;

app.get("/api/status", (_, res) => res.json({configured: !!KEY, model: KEY ? MODEL : null}));

app.post("/api/analyze", async (req, res) => {
  if (!KEY) return res.status(503).json({error: "The AI is not connected. The site owner must set GEMINI_API_KEY on the server."});
  const {topic, question, explanation, confidence, challenge} = req.body || {};
  if (!topic || typeof explanation !== "string" || explanation.trim().length < 40)
    return res.status(400).json({error: "Write at least a few sentences explaining the topic in your own words."});
  const clip = (s, n) => String(s || "").slice(0, n);
  let prompt = `Topic: ${clip(topic, 120)}\nQuestion: ${clip(question, 400) || "(none)"}\nStudent confidence: ${Number(confidence) || 0}%\nStudent explanation:\n"""${clip(explanation, 4000)}"""`;
  if (challenge?.reply) prompt += `\n\nYour earlier feedback (JSON): ${clip(JSON.stringify(challenge.previous), 3000)}\nThe student DISAGREES and says: "${clip(challenge.reply, 1000)}"`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: {"Content-Type": "application/json", "x-goog-api-key": KEY},
      body: JSON.stringify({
        systemInstruction: {parts: [{text: SYSTEM}]},
        contents: [{role: "user", parts: [{text: prompt}]}],
        generationConfig: {responseMimeType: "application/json", temperature: 0.4}
      })
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({error: j.error?.message || "The AI service returned an error."});
    const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text).join("");
    const out = JSON.parse(text.replace(/^```json|```$/g, "").trim());
    const arr = a => (Array.isArray(a) ? a.map(String).slice(0, 4) : []);
    res.json({
      level: String(out.level || "Unclear"), score: Math.max(0, Math.min(100, Math.round(+out.score || 0))),
      certainty: String(out.certainty || "low"), assessment: String(out.assessment || ""), uncertaintyNote: String(out.uncertaintyNote || ""),
      gaps: arr(out.gaps), weaknesses: arr(out.weaknesses), suggestions: arr(out.suggestions),
      thoughtQuestion: String(out.thoughtQuestion || ""), followUp: String(out.followUp || ""), challengeReply: String(out.challengeReply || "")
    });
  } catch (e) {
    res.status(502).json({error: "Could not get a readable answer from the AI. Please try again."});
  }
});

app.use(express.static(dist));
app.use((_, res) => res.sendFile(path.join(dist, "index.html")));
app.listen(process.env.PORT || 3001, () => console.log("ExplainMirror running. AI connected:", !!KEY));
