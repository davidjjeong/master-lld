import { NextResponse } from "next/server";
import OpenAI from "openai";
import { formatMasteryContext } from "../../../lib/mastery-prompts";

export const runtime = "nodejs";

const fallbackQuestions: Record<string, string> = {
  "Amazon Locker": "How would you support different package dimensions or a pickup notification without changing the core deposit flow?",
  "Parking Lot": "How would you add reservations while keeping walk-in parking behavior understandable?",
  "Elevator System": "How would you support multiple elevators while keeping request assignment replaceable?",
  "Vending Machine": "How would you add a new payment method without changing product-dispensing rules?",
  "Tic-Tac-Toe": "How would you support a different board size or win condition without rewriting the game flow?",
  "Rate Limiter": "How would you make the limiting policy swappable while preserving the caller-facing API?",
  "Connect Four": "How would you support a different board size or connect-N rule?",
  "Library Management": "How would you add reservations or renewal limits without coupling them to BookCopy?",
  "Coffee Machine": "How would you add a new drink recipe without changing the transaction lifecycle?",
  ATM: "How would you support multiple account types or a new transaction type without making ATM a giant conditional?",
  "Movie Ticket Booking": "How would you add temporary seat holds with expiration while keeping booking state clear?",
  "Hotel Booking": "How would you add pricing or room upgrades without mixing them into availability checks?",
  Splitwise: "How would you add percentage-based or itemized splits without changing expense storage?",
  "File System": "How would you add permissions while keeping path resolution independent of authorization?",
  "Logger Framework": "How would you add asynchronous handlers without changing the logger call sites?",
  "Notification Service": "How would you add a new channel or fallback delivery without changing callers?",
  "Car Rental": "How would you add vehicle categories or one-way returns without changing reservation rules?",
  "Pub-Sub System": "How would you add retry or dead-letter handling without blocking unrelated subscribers?",
  "Task Scheduler": "How would you add recurring tasks without changing one-time task execution?",
  "Payment Processor": "How would you add a second payment provider while keeping idempotency consistent?",
  "Feed Generator": "How would you add a chronological ranking policy without changing the feed API?",
  "Inventory Management": "How would you add multiple warehouses while keeping reservation behavior consistent?",
  "Ride Sharing": "How would you make matching replaceable for pooled rides without changing ride lifecycle?",
  "Food Delivery": "How would you support multiple restaurants in one checkout without breaking order ownership?",
  "Subscription Billing": "How would you add trials or plan changes without duplicating renewal logic?",
};

function stripThinking(value: string) {
  return value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export async function POST(request: Request) {
  let body: { problem?: string; difficulty?: string; problemDescription?: string; masteryPrompt?: string; answer?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.problem) return NextResponse.json({ error: "Problem is required." }, { status: 400 });

  const fallback = fallbackQuestions[body.problem] || "What meaningful product change would test this design, and how would you extend it without changing stable behavior?";
  if (!process.env.LLM_API_KEY) return NextResponse.json({ question: fallback });

  const client = new OpenAI({ apiKey: process.env.LLM_API_KEY, baseURL: process.env.LLM_BASE_URL });
  const prompt = `Problem: ${body.problem} (${body.difficulty || "unknown difficulty"})\nAuthoritative mastery context:\n${formatMasteryContext(body.problem)}\nExisting design notes:\n${(body.answer || "").slice(0, 8000)}`;
  try {
    const response = await client.chat.completions.create({
      model: process.env.LLM_MODEL || "gpt-4.1-mini",
      messages: [
        { role: "system", content: "You are a low-level design interviewer for a new-grad big-tech interview. Generate exactly one concise follow-up question for the named problem. Change one meaningful product rule or capability, test whether the design can evolve, and do not provide hints or a solution. Return only the question in at most 40 words." },
        { role: "user", content: prompt },
      ],
      max_tokens: 256,
    });
    const question = stripThinking(response.choices[0]?.message?.content || "");
    if (!question) throw new Error("Empty follow-up response");
    return NextResponse.json({ question: question.replace(/^['"]|['"]$/g, "") });
  } catch (error) {
    console.error("LLM follow-up request failed", error);
    return NextResponse.json({ question: fallback, fallback: true });
  }
}
