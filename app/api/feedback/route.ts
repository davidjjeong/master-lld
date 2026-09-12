import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  formatRubricContext,
  getMasteryPrompt,
  getRubricCriteria,
  type MasteryStep,
  type RubricCriterion,
} from "../../../lib/mastery-prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

type ScoreBand = "RED" | "ORANGE" | "LIGHT GREEN" | "DARK GREEN";
type EvaluationStatus = "covered" | "implicit" | "ambiguous" | "missing" | "contradicted";
type CriterionEvaluation = {
  id: string;
  status: EvaluationStatus;
  evidence: string;
  rationale: string;
  confidence: number;
};
type Evaluation = {
  criteria: CriterionEvaluation[];
  logicSummary: string;
  contradictions: string[];
};
type GeneratedFeedback = {
  summary: string;
  strengths: string[];
  gaps: string[];
  suggestions: string[];
  nextImprovement: string;
};

const evaluationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["criteria", "logicSummary", "contradictions"],
  properties: {
    criteria: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "status", "evidence", "rationale", "confidence"],
        properties: {
          id: { type: "string" },
          status: { type: "string", enum: ["covered", "implicit", "ambiguous", "missing", "contradicted"] },
          evidence: { type: "string" },
          rationale: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
    logicSummary: { type: "string" },
    contradictions: { type: "array", items: { type: "string" } },
  },
} as const;

const feedbackSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "strengths", "gaps", "suggestions", "nextImprovement"],
  properties: {
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
    suggestions: { type: "array", items: { type: "string" } },
    nextImprovement: { type: "string" },
  },
} as const;

function stripThinking(value: string) {
  return value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function stripProtectedInstructions(value: string) {
  const lines = value.split("\n");
  const start = lines.findIndex((line) => line.trim() === "# ====== BEGIN INSTRUCTIONS ======");
  const end = lines.findIndex((line, index) => index > start && line.trim() === "# ====== END INSTRUCTIONS ======");
  if (start >= 0 && end > start) return lines.filter((_, index) => index < start || index > end).join("\n").trim();
  return value.trim();
}

function parseJson<T>(value: string): T {
  const cleaned = stripThinking(value).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(cleaned) as T;
}

function normalized(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function evidenceIsInAnswer(evidence: string, answer: string) {
  const quote = normalized(evidence);
  const candidate = normalized(answer);
  return Boolean(quote) && quote.length >= 3 && candidate.includes(quote);
}

function evidenceExcerpt(criterion: RubricCriterion, answer: string) {
  const ignored = new Set(["expect", "clear", "meaningful", "focused", "simple", "common", "reasonable", "behavior", "state", "rules", "rule", "design", "flow", "change"]);
  const terms = `${criterion.label} ${criterion.acceptableEvidence}`.toLowerCase().match(/[a-z0-9_]+/g) || [];
  const prefixes = [...new Set(terms.filter((term) => term.length >= 4 && !ignored.has(term)).map((term) => term.slice(0, Math.min(term.length, 5))))];
  const chunks = answer.split(/\n+|(?<=[.!?;])\s+/).map((chunk) => chunk.trim()).filter(Boolean);
  let best = { score: 0, text: "" };
  for (const chunk of chunks) {
    const chunkPrefixes = new Set((chunk.toLowerCase().match(/[a-z0-9_]+/g) || []).map((term) => term.slice(0, Math.min(term.length, 5))));
    const score = prefixes.reduce((total, prefix) => total + (chunkPrefixes.has(prefix) ? 1 : 0), 0);
    if (score > best.score) best = { score, text: chunk };
  }
  const minimumScore = prefixes.length > 3 ? 2 : 1;
  return best.score >= minimumScore ? best.text.slice(0, 240) : "";
}

function normalizeEvaluation(raw: Evaluation, rubric: RubricCriterion[], answer: string): Evaluation {
  const byId = new Map(raw.criteria.map((criterion) => [criterion.id, criterion]));
  const validStatuses = new Set<EvaluationStatus>(["covered", "implicit", "ambiguous", "missing", "contradicted"]);
  return {
    criteria: rubric.map((criterion) => {
      const item = byId.get(criterion.id);
      if (!item) return { id: criterion.id, status: "missing", evidence: "", rationale: "The reviewer did not evaluate this criterion.", confidence: 0 };
      const rawStatus = validStatuses.has(item.status) ? item.status : "ambiguous";
      const canUseEvidence = rawStatus === "covered" || rawStatus === "implicit" || rawStatus === "contradicted";
      const quotedEvidence = canUseEvidence && evidenceIsInAnswer(item.evidence, answer) ? item.evidence.trim() : canUseEvidence ? evidenceExcerpt(criterion, answer) : "";
      const hasEvidence = Boolean(quotedEvidence);
      const positive = rawStatus === "covered" || rawStatus === "implicit";
      const status: EvaluationStatus = (positive || rawStatus === "contradicted") && !hasEvidence ? "ambiguous" : rawStatus;
      return {
        id: criterion.id,
        status,
        evidence: hasEvidence ? quotedEvidence : "",
        rationale: item.rationale.trim().slice(0, 260),
        confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)),
      };
    }),
    logicSummary: raw.logicSummary.trim().slice(0, 500),
    contradictions: raw.contradictions.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 4),
  };
}

function combineEvaluations(first: Evaluation, second: Evaluation) {
  const secondById = new Map(second.criteria.map((criterion) => [criterion.id, criterion]));
  const criteria = first.criteria.map((item) => {
    const other = secondById.get(item.id);
    if (!other) return { ...item, status: "ambiguous" as const, rationale: "Only one independent reviewer returned a result for this criterion." };
    const bothPositive = (item.status === "covered" || item.status === "implicit") && (other.status === "covered" || other.status === "implicit");
    if (bothPositive) {
      return { ...item, status: item.status === "covered" || other.status === "covered" ? "covered" as const : "implicit" as const, evidence: item.evidence || other.evidence };
    }
    if (item.status === other.status) return item;
    const evidence = item.evidence || other.evidence;
    return {
      id: item.id,
      status: "ambiguous" as const,
      evidence,
      rationale: "The independent reviewers disagreed, so this criterion is not used as a hard penalty.",
      confidence: Math.min(item.confidence, other.confidence),
    };
  });
  return { criteria, logicSummary: first.logicSummary || second.logicSummary, contradictions: [...first.contradictions, ...second.contradictions].slice(0, 5) };
}

function deriveScore(evaluation: Evaluation, rubric: RubricCriterion[], answer: string) {
  if (!answer.trim()) return { score: "RED" as ScoreBand, numericScore: 0 };
  const byId = new Map(rubric.map((criterion) => [criterion.id, criterion]));
  const coreIssues = evaluation.criteria.filter((item) => byId.get(item.id)?.importance === "core" && (item.status === "missing" || item.status === "contradicted"));
  const supportingIssues = evaluation.criteria.filter((item) => byId.get(item.id)?.importance === "supporting" && (item.status === "missing" || item.status === "contradicted"));
  const ambiguous = evaluation.criteria.some((item) => item.status === "ambiguous");
  if (coreIssues.length >= 2) return { score: "ORANGE" as ScoreBand, numericScore: 5 };
  if (coreIssues.length === 1 || supportingIssues.length >= 2) return { score: "LIGHT GREEN" as ScoreBand, numericScore: 7 };
  if (supportingIssues.length === 1 || ambiguous) return { score: "DARK GREEN" as ScoreBand, numericScore: 8 };
  return { score: "DARK GREEN" as ScoreBand, numericScore: 9 };
}

function isLocalMlx() {
  return process.env.LLM_BASE_URL?.includes("127.0.0.1") || process.env.LLM_BASE_URL?.includes("localhost");
}

async function requestStructuredJson<T>(client: OpenAI, messages: Array<{ role: "system" | "user"; content: string }>, schema: typeof evaluationSchema | typeof feedbackSchema, name: string): Promise<T> {
  const requestOptions = {
    model: process.env.LLM_MODEL || "gpt-4.1-mini",
    messages,
    max_tokens: 1400,
    temperature: 0.1,
    ...(isLocalMlx() ? { extra_body: { chat_template_kwargs: { enable_thinking: false } } } : {}),
  };
  let response;
  try {
    response = await client.chat.completions.create({
      ...requestOptions,
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
    });
  } catch (error) {
    // Older local OpenAI-compatible servers may not implement json_schema.
    // Keep the same instructions and fall back to JSON mode only for local MLX.
    if (!isLocalMlx()) throw error;
    response = await client.chat.completions.create({
      ...requestOptions,
      messages: [{ role: "system", content: `${messages[0]?.content || ""}\nReturn only valid JSON matching this schema: ${JSON.stringify(schema)}` }, ...messages.slice(1)],
      response_format: { type: "json_object" },
    });
  }
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("The configured model returned an empty response.");
  return parseJson<T>(content);
}

const evaluationSystem = `You are the evaluator for a 30–45 minute low-level design interview for a new graduate engineer. Evaluate only the named step of the named problem against the supplied canonical rubric.

This is open-ended LLD. First read the entire candidate answer and reconstruct its flow: inputs, state, conditionals, ownership, transitions, return values, and comments. Treat pseudocode as valid. Grade logic and coherent object-oriented design much more heavily than language syntax, formatting, naming, or whether an exact method signature was used.

For every criterion, choose exactly one status:
- covered: the answer clearly handles it;
- implicit: the answer communicates it through an equivalent method, state transition, condition, helper, or comment;
- ambiguous: there may be evidence, but the behavior or ownership is unclear;
- missing: the answer does not address it;
- contradicted: the answer explicitly says or implements something incompatible with the criterion.

Use exact short excerpts from the candidate answer as evidence for covered, implicit, and contradicted. Do not invent evidence. A reasonable alternative design is not a contradiction. Do not penalize a candidate for omitting details that belong to another step or are outside the exercise. Do not demand a specific class or return type when the candidate's design preserves the same invariant and behavior. If a condition or comment makes the behavior clear, count it even when the prose is not explicit.

Do not reward or penalize based on a generic checklist. The rubric is problem-specific. Pay special attention to the actual values and rules in the rubric, including exact sizes, durations, lifecycle states, and failure behavior. Return a careful criterion-by-criterion judgment, not feedback prose.`;

const writerSystem = `You write concise coaching feedback for a new graduate engineer practicing low-level design for big-tech interviews. The problem, step, canonical rubric, candidate answer, and verified evidence map are supplied.

Only use the verified evidence map. Do not introduce a gap unless the map marks that criterion missing, contradicted, or clearly ambiguous. When a candidate expresses the right logic indirectly, acknowledge it and do not repeat it as an improvement. Be flexible about pseudocode, syntax, naming, method signatures, and reasonable alternative class boundaries. Focus on invariants, ownership, state transitions, and whether the answer flows coherently.

Keep the sections distinct: strengths describe what the answer already demonstrates; gaps identify at most two material risks; suggestions are concrete additions tied to this problem and this step; nextImprovement is one short action for the next attempt. Do not restate the same sentence in all sections. Keep each item to one or two short sentences. Do not mention hidden rubrics, reviewers, scoring mechanics, or a reference answer.`;

function normalizeGeneratedFeedback(raw: GeneratedFeedback, problem: string, step: string): GeneratedFeedback {
  const clean = (value: unknown, limit: number) => typeof value === "string" ? stripThinking(value).trim().slice(0, limit) : "";
  const list = (value: unknown, limit: number) => Array.isArray(value) ? value.map((item) => clean(item, limit)).filter(Boolean).slice(0, 3) : [];
  return {
    summary: clean(raw.summary, 600) || `Your ${step.toLowerCase()} response for ${problem} was reviewed against the problem-specific criteria.`,
    strengths: list(raw.strengths, 300),
    gaps: list(raw.gaps, 300),
    suggestions: list(raw.suggestions, 300),
    nextImprovement: clean(raw.nextImprovement, 300) || `Make one concrete improvement to this ${step.toLowerCase()} response and keep the main flow intact.`,
  };
}

function criterionResultsForUi(evaluation: Evaluation, rubric: RubricCriterion[]) {
  const byId = new Map(rubric.map((criterion) => [criterion.id, criterion]));
  return evaluation.criteria.map((item) => ({
    id: item.id,
    label: byId.get(item.id)?.label || item.id,
    importance: byId.get(item.id)?.importance || "supporting",
    status: item.status,
    evidence: item.evidence,
    rationale: item.rationale,
    confidence: item.confidence,
  }));
}

function feedbackFromEvaluation(evaluation: Evaluation, rubric: RubricCriterion[], problem: string, step: string): GeneratedFeedback {
  const byId = new Map(rubric.map((criterion) => [criterion.id, criterion]));
  const strengths = evaluation.criteria.filter((item) => item.status === "covered" || item.status === "implicit").slice(0, 3).map((item) => `Your response addresses ${byId.get(item.id)?.label || "this criterion"}.`);
  const issues = evaluation.criteria.filter((item) => item.status === "missing" || item.status === "contradicted" || item.status === "ambiguous").slice(0, 2);
  const gaps = issues.map((item) => `${item.status === "contradicted" ? "The response conflicts with" : item.status === "ambiguous" ? "Clarify" : "Add"} ${byId.get(item.id)?.label || "this criterion"}.`);
  const suggestions = issues.slice(0, 3).map((item) => `Show the relevant ${byId.get(item.id)?.label || "behavior"} in one concrete sentence, condition, or state transition.`);
  return {
    summary: strengths.length ? `Your ${step.toLowerCase()} response for ${problem} has a coherent core and covers ${strengths.length} key ${strengths.length === 1 ? "criterion" : "criteria"}.` : `Your ${step.toLowerCase()} response for ${problem} needs a clearer core before it can be evaluated confidently.`,
    strengths,
    gaps,
    suggestions,
    nextImprovement: gaps[0] || `Keep the ${step.toLowerCase()} flow concise and make the ownership or state transition explicit.`,
  };
}

export async function POST(request: Request) {
  let body: { problem?: string; difficulty?: string; step?: string; stepPrompt?: string; answer?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const problem = body.problem?.trim();
  const step = body.step?.trim() as MasteryStep;
  if (!problem || !step || !["Requirements", "Entities", "Class design", "Implementation", "Extensibility"].includes(step)) {
    return NextResponse.json({ error: "Problem and a valid step are required." }, { status: 400 });
  }

  const answer = stripProtectedInstructions(typeof body.answer === "string" ? body.answer : "");
  const rubric = getRubricCriteria(problem, step);
  if (!answer.trim()) {
    return NextResponse.json({
      feedback: {
        score: "RED",
        numericScore: 0,
        summary: `No answer was provided for the ${step.toLowerCase()} section of ${problem}.`,
        strengths: [],
        gaps: ["There is no candidate response to evaluate yet."],
        suggestions: [`Add a concise ${step.toLowerCase()} response for ${problem} before requesting feedback.`],
        nextImprovement: `Write the first pass for this ${step.toLowerCase()} section, then request feedback again.`,
        criterionResults: rubric.map((criterion) => ({ id: criterion.id, label: criterion.label, importance: criterion.importance, status: "missing", evidence: "", rationale: "No answer was provided.", confidence: 1 })),
      },
    });
  }

  if (!process.env.LLM_API_KEY) {
    return NextResponse.json({ error: "AI feedback is not configured for this deployment." }, { status: 503 });
  }

  const client = new OpenAI({ apiKey: process.env.LLM_API_KEY, baseURL: process.env.LLM_BASE_URL });
  const context = `Problem: ${problem} (${body.difficulty || "unknown difficulty"})\nStep: ${step}\nProblem brief: ${getMasteryPrompt(problem).brief}\nCanonical rubric for this step:\n${formatRubricContext(problem, step)}\nCandidate answer:\n${answer.slice(0, 12000)}`;

  try {
    const reviewerResults = await Promise.allSettled([
      requestStructuredJson<Evaluation>(client, [{ role: "system", content: evaluationSystem }, { role: "user", content: context }], evaluationSchema, "lld_evaluation_a"),
      requestStructuredJson<Evaluation>(client, [{ role: "system", content: evaluationSystem }, { role: "user", content: `${context}\n\nIndependently verify the answer. Re-read it from the beginning and check every conditional, comment, and state transition before returning the evaluation.` }], evaluationSchema, "lld_evaluation_b"),
    ]);
    const successfulEvaluations = reviewerResults.filter((result): result is PromiseFulfilledResult<Evaluation> => result.status === "fulfilled").map((result) => normalizeEvaluation(result.value, rubric, answer));
    if (!successfulEvaluations.length) throw new Error("Both independent feedback reviewers failed.");
    const evaluation = successfulEvaluations.length === 1 ? { ...successfulEvaluations[0], logicSummary: `${successfulEvaluations[0].logicSummary} Only one reviewer was available for this review.` } : combineEvaluations(successfulEvaluations[0], successfulEvaluations[1]);
    const derived = deriveScore(evaluation, rubric, answer);
    const writerContext = `${context}\n\nVerified evidence map:\n${JSON.stringify(criterionResultsForUi(evaluation, rubric))}\n\nReviewer logic summary: ${evaluation.logicSummary}`;
    let generated: GeneratedFeedback;
    try {
      generated = await requestStructuredJson<GeneratedFeedback>(client, [{ role: "system", content: writerSystem }, { role: "user", content: writerContext }], feedbackSchema, "lld_feedback");
    } catch (error) {
      console.error("LLM feedback writer failed; using verified deterministic summary", error);
      generated = feedbackFromEvaluation(evaluation, rubric, problem, step);
    }
    return NextResponse.json({ feedback: { ...normalizeGeneratedFeedback(generated, problem, step), ...derived, criterionResults: criterionResultsForUi(evaluation, rubric) } });
  } catch (error) {
    console.error("LLM feedback request failed", error);
    return NextResponse.json({ error: "Could not reach the configured AI coach for feedback." }, { status: 502 });
  }
}
