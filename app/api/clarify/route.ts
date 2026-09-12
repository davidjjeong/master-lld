import { NextResponse } from "next/server";
import OpenAI from "openai";
import { formatMasteryContext } from "../../../lib/mastery-prompts";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ClarifyRequest = { problem: string; difficulty: string; problemDescription?: string; masteryPrompt?: string; question: string; history?: ChatMessage[] };

function canonicalAmazonAnswer(question: string) {
  const normalized = question.toLowerCase();
  if (/(size|small|medium|large|compartment)/.test(normalized)) {
    return "We have SMALL, MEDIUM, and LARGE compartments. Match the package to the exact same size; do not use a larger compartment as fallback.";
  }
  if (/(expir|valid|how long|days?)/.test(normalized)) {
    return "Access codes expire 7 days after creation. An invalid or expired code returns false, and the package remains in the compartment.";
  }
  if (/(scope|out of scope|manager|staff|notification|ui)/.test(normalized)) {
    return "Keep this exercise focused on deposit and retrieval. Manager removal, notifications, and UI are out of scope.";
  }
  return null;
}

function stripThinking(value: string) {
  return value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export async function POST(request: Request) {
  let body: ClarifyRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.problem || !body.question?.trim()) {
    return NextResponse.json({ error: "Problem and question are required." }, { status: 400 });
  }

  // These are confirmed requirements for the canonical Amazon Locker exercise;
  // do not let a model replace them with a different interview variant.
  if (body.problem === "Amazon Locker") {
    const answer = canonicalAmazonAnswer(body.question.trim());
    if (answer) return NextResponse.json({ answer });
  }

  const masteryContext = formatMasteryContext(body.problem);
  const system = `You are the interviewer for a 30–45 minute low-level design practice session with a new graduate engineer. The problem is ${body.problem} (${body.difficulty}). The authoritative mastery prompt is below; use it to answer consistently, but reveal only the minimum needed for the candidate's exact question.

${masteryContext}

Answer only the candidate's exact clarifying question, as a realistic product interviewer would, and stay faithful to that brief. Use at most two short sentences and no more than 45 words. Keep the exercise focused on the core happy path, roughly two to four operations, and only the most important one or two failure cases. Do not introduce authentication, distributed systems, persistence, analytics, admin workflows, notifications, or extra actors unless the candidate explicitly asks about them. Do not volunteer related requirements, hints, entities, classes, APIs, or implementation. If the detail is unspecified, state one reasonable simple assumption briefly and stop. Never reveal a complete solution or expand the scope just because it is possible.`;
  const history = (body.history || []).filter((message) => message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string").slice(-8);
  const messages = [{ role: "system" as const, content: system }, ...history, { role: "user" as const, content: body.question.trim() }];

  if (!process.env.LLM_API_KEY) {
    return NextResponse.json({ answer: "Please make one focused assumption for this detail, record it in your requirements, and continue with the next question." });
  }

  const client = new OpenAI({ apiKey: process.env.LLM_API_KEY, baseURL: process.env.LLM_BASE_URL });
  try {
    const response = await client.chat.completions.create({ model: process.env.LLM_MODEL || "gpt-4.1-mini", messages, max_tokens: 512 });
    const answer = stripThinking(response.choices[0]?.message?.content || "");
    if (!answer) throw new Error("The interviewer returned an empty response.");
    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Clarifying question request failed", error);
    return NextResponse.json({ error: "Could not reach the configured AI interviewer." }, { status: 502 });
  }
}
