"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { formatMasteryContext, getMasteryPrompt } from "../lib/mastery-prompts";
import { createClient, isSupabaseConfigured } from "../lib/supabase/client";

type Problem = { id: string; title: string; difficulty: "Easy" | "Medium" | "Hard"; time: string; description: string; icon: string; tone: string };
type Feedback = { score: string; numericScore: number; summary: string; strengths: string[]; gaps: string[]; suggestions: string[]; nextImprovement: string };
type ChatMessage = { role: "user" | "assistant"; content: string };
type Tab = "answer" | "questions" | "feedback" | "suggestions";
type SavedPractice = {
  id: string;
  problem_id: string;
  problem_title: string;
  difficulty: string;
  current_step: number;
  answer: string;
  step_scores: Record<number, string>;
  feedback: Feedback | null;
  follow_up_question: string | null;
  timer_seconds: number;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

const problems: Problem[] = [
  { id: "locker", title: "Amazon Locker", difficulty: "Easy", time: "25 min", description: "Design a secure system for depositing and retrieving packages from lockers.", icon: "▣", tone: "orange" },
  { id: "parking", title: "Parking Lot", difficulty: "Medium", time: "35 min", description: "Model a multi-level parking lot with different vehicle and spot sizes.", icon: "⌁", tone: "blue" },
  { id: "elevator", title: "Elevator System", difficulty: "Medium", time: "40 min", description: "Design an elevator controller that serves requests efficiently and safely.", icon: "⇅", tone: "purple" },
  { id: "vending", title: "Vending Machine", difficulty: "Easy", time: "25 min", description: "Handle inventory, product selection, payment, and change.", icon: "▥", tone: "yellow" },
  { id: "tic", title: "Tic-Tac-Toe", difficulty: "Easy", time: "20 min", description: "Build a turn-based game with clean, extensible rules.", icon: "＋", tone: "red" },
  { id: "ratelimiter", title: "Rate Limiter", difficulty: "Hard", time: "45 min", description: "Design a configurable rate limiter that works correctly under load.", icon: "◌", tone: "pink" },
  { id: "connect-four", title: "Connect Four", difficulty: "Easy", time: "25 min", description: "Design a two-player board game with a configurable win condition.", icon: "●", tone: "blue" },
  { id: "library", title: "Library Management", difficulty: "Easy", time: "30 min", description: "Model books, members, borrowing, returns, and availability.", icon: "▤", tone: "purple" },
  { id: "coffee", title: "Coffee Machine", difficulty: "Easy", time: "25 min", description: "Handle recipes, ingredients, payment, and drink preparation.", icon: "☕", tone: "orange" },
  { id: "atm", title: "ATM", difficulty: "Medium", time: "35 min", description: "Design authentication, balance checks, withdrawals, deposits, and cash limits.", icon: "▣", tone: "yellow" },
  { id: "movie", title: "Movie Ticket Booking", difficulty: "Medium", time: "40 min", description: "Reserve seats for showtimes while preventing double booking.", icon: "▰", tone: "red" },
  { id: "hotel", title: "Hotel Booking", difficulty: "Medium", time: "35 min", description: "Search rooms, make reservations, cancel bookings, and track availability.", icon: "⌂", tone: "blue" },
  { id: "splitwise", title: "Splitwise", difficulty: "Medium", time: "40 min", description: "Track shared expenses and calculate who owes whom.", icon: "÷", tone: "green" },
  { id: "filesystem", title: "File System", difficulty: "Medium", time: "40 min", description: "Model directories, files, paths, and common file operations.", icon: "⌁", tone: "purple" },
  { id: "logger", title: "Logger Framework", difficulty: "Medium", time: "30 min", description: "Build configurable log levels, handlers, and message formatting.", icon: "≡", tone: "pink" },
  { id: "notification", title: "Notification Service", difficulty: "Medium", time: "40 min", description: "Route notifications across channels with preferences and delivery status.", icon: "♢", tone: "yellow" },
  { id: "car-rental", title: "Car Rental", difficulty: "Medium", time: "40 min", description: "Search, reserve, pick up, and return vehicles with availability tracking.", icon: "▱", tone: "orange" },
  { id: "pub-sub", title: "Pub-Sub System", difficulty: "Hard", time: "45 min", description: "Deliver published messages to subscribed consumers with clear ownership.", icon: "◉", tone: "red" },
  { id: "task-scheduler", title: "Task Scheduler", difficulty: "Medium", time: "40 min", description: "Schedule, cancel, and execute tasks with priorities and retry rules.", icon: "◷", tone: "blue" },
  { id: "payment", title: "Payment Processor", difficulty: "Hard", time: "45 min", description: "Model payment attempts, idempotency, refunds, and transaction states.", icon: "$", tone: "purple" },
  { id: "feed", title: "Feed Generator", difficulty: "Hard", time: "45 min", description: "Build a personalized feed from authors, posts, and ranking rules.", icon: "≋", tone: "pink" },
  { id: "inventory", title: "Inventory Management", difficulty: "Medium", time: "35 min", description: "Track stock, reservations, restocking, and order fulfillment.", icon: "▦", tone: "green" },
  { id: "ride-sharing", title: "Ride Sharing", difficulty: "Hard", time: "45 min", description: "Match riders and drivers while tracking trip lifecycle and pricing.", icon: "⌁", tone: "orange" },
  { id: "food-delivery", title: "Food Delivery", difficulty: "Medium", time: "40 min", description: "Model menus, orders, restaurant acceptance, and delivery status.", icon: "⌂", tone: "red" },
  { id: "subscription", title: "Subscription Billing", difficulty: "Medium", time: "40 min", description: "Handle plans, renewals, cancellations, and payment state changes.", icon: "↻", tone: "yellow" },
];

const steps = ["Requirements", "Entities", "Class design", "Implementation", "Extensibility"];
const sectionMarkers = ["# REQUIREMENTS", "# ENTITIES & RELATIONSHIPS", "# CLASS DESIGN", "# IMPLEMENTATION", "# EXTENSIBILITY"];
const instructionStart = "# ====== BEGIN INSTRUCTIONS ======";
const instructionEnd = "# ====== END INSTRUCTIONS ======";
const implementationPrompts: Record<string, string> = {
  locker: "Implement depositPackage(packageSize) for SMALL, MEDIUM, or LARGE exact-size matching and retrievePackage(accessCode) with seven-day expiry.",
  parking: "Implement park(vehicle) with the smallest compatible spot, ticket creation, rejection when full, and unpark(ticketId) to free the spot.",
  elevator: "Implement floor requests, next-stop selection, safe elevator movement, and invalid or duplicate request handling.",
  vending: "Implement product selection, payment, inventory checks, dispensing, change/refund, cancellation, and unavailable products.",
  tic: "Implement makeMove(player, row, column), illegal-move rejection, win/draw detection, and turn switching.",
  ratelimiter: "Implement allow(clientId) for a configurable time-based request limit, accepted-request state, and rejection over the limit.",
  "connect-four": "Implement dropping a piece into a column, invalid-move rejection, connected-four detection, and alternating turns.",
  library: "Implement borrowBook and returnBook with eligibility, copy availability, loan creation, and invalid-loan handling.",
  coffee: "Implement recipe selection, ingredient/payment validation, dispensing, change, and refund for failed orders.",
  atm: "Implement card/PIN authentication, balance and cash validation, atomic withdrawal, deposit, and cancellation.",
  movie: "Implement show-specific seat holds, confirmation, cancellation, conflict rejection, and seat release.",
  hotel: "Implement date-range availability, reservation creation, overlap rejection, and cancellation.",
  splitwise: "Implement equal or specified expense splits, balance updates, validation, and settlement.",
  filesystem: "Implement path resolution, directory/file creation, listing, duplicate-name rejection, and invalid paths.",
  logger: "Implement log-level filtering, record formatting, and delivery to configured handlers.",
  notification: "Implement preference-aware channel selection, delivery status, and channel failure handling.",
  "car-rental": "Implement vehicle search, non-overlapping reservation, checkout, return, and invalid lifecycle rejection.",
  "pub-sub": "Implement topic subscription, unsubscribe, publish delivery, duplicate handling, and consumer failure isolation.",
  "task-scheduler": "Implement task submission, priority/time selection, cancellation, execution, and bounded retries.",
  payment: "Implement idempotent payment attempts, transaction states, duplicate-charge prevention, and eligible refunds.",
  feed: "Implement followed-author post collection, ranking, pagination, and a no-results response.",
  inventory: "Implement stock reservation, insufficient-stock rejection, cancellation release, restocking, and fulfillment.",
  "ride-sharing": "Implement ride request, driver matching, accepted/started/completed transitions, and cancellation.",
  "food-delivery": "Implement order creation, menu validation, restaurant accept/reject, courier assignment, and status transitions.",
  subscription: "Implement plan subscription, successful renewal, failed billing, invoice state, and cancellation.",
};

function getStepPrompt(problem: Problem, step: string, followUpQuestion?: string) {
  const mastery = getMasteryPrompt(problem.title);
  if (step === "Requirements") return `Ask focused clarifying questions, then write confirmed requirements for ${mastery.brief}`;
  if (step === "Entities") return `Identify entities and ownership for ${problem.title}. Intended direction: ${mastery.entities}`;
  if (step === "Class design") return `Define state and public methods for ${problem.title}. Intended direction: ${mastery.classDesign}`;
  if (step === "Extensibility") return `Evaluate the response to this ${problem.title} follow-up: ${followUpQuestion || mastery.extensibility}`;
  return `${implementationPrompts[problem.id]} Intended direction: ${mastery.implementation}`;
}

function getSectionTemplate(problem: Problem, index: number) {
  const marker = sectionMarkers[index];
  if (index === 0) return `${instructionStart}\n${marker}\n\n# Problem prompt: ${getMasteryPrompt(problem.title).brief}\n# Prompt the AI/interviewer with focused clarifying questions before writing requirements.\n# Record only confirmed capabilities, rules, error handling, and scope boundaries.\n${instructionEnd}`;
  if (index === 1) return `${instructionStart}\n${marker}\n\n# Identify the objects that own meaningful state or enforce rules.\n# Describe ownership and how the objects collaborate.\n${instructionEnd}`;
  if (index === 2) return `${instructionStart}\n${marker}\n\n# For each entity, sketch the state it owns and its public methods.\n# Keep behavior close to the data and rules it protects.\n${instructionEnd}`;
  if (index === 3) return `${instructionStart}\n${marker}\n\n# ${getStepPrompt(problem, "Implementation")}\n# Show the happy path first, then the important edge cases.\n${instructionEnd}`;
  return `${instructionStart}\n${marker}\n\n# Ask the AI for one realistic follow-up question that changes a meaningful requirement.\n# Explain the smallest design change, what remains stable, and the trade-off.\n${instructionEnd}`;
}

function getStarter(problem: Problem) { return getSectionTemplate(problem, 0); }
function revealStep(answer: string, problem: Problem, index: number) {
  if (answer.includes(sectionMarkers[index])) return answer;
  return `${answer.trimEnd()}\n\n${getSectionTemplate(problem, index)}`;
}
function getCurrentSection(answer: string, step: number) {
  const start = answer.indexOf(sectionMarkers[step]);
  if (start < 0) {
    // A structured answer missing this step must not fall back to another
    // section. Only unstructured legacy text can be treated as step one.
    return sectionMarkers.some((marker) => answer.includes(marker)) || step > 0 ? "" : answer;
  }
  const nextStart = sectionMarkers.slice(step + 1).map((marker) => answer.indexOf(marker)).find((index) => index >= 0);
  return answer.slice(start, nextStart ?? answer.length).trim();
}

function removeProtectedInstructions(section: string) {
  let cleaned = section;
  while (true) {
    const start = cleaned.indexOf(instructionStart);
    if (start < 0) return cleaned.trim();
    const contentStart = start + instructionStart.length;
    const end = cleaned.indexOf(instructionEnd, contentStart);
    if (end < 0) return cleaned.slice(0, start).trim();
    cleaned = `${cleaned.slice(0, start)}${cleaned.slice(end + instructionEnd.length)}`;
  }
}

function removeLegacyTemplateInstructions(section: string, problem: Problem, step: number) {
  const template = getSectionTemplate(problem, step);
  const markerStart = template.indexOf(sectionMarkers[step]);
  const templateSection = template.slice(markerStart);
  if (section.startsWith(templateSection)) return section.slice(templateSection.length).trim();

  // Older saved practices may contain the same boilerplate without the
  // BEGIN/END markers. Remove only the exact leading template lines so
  // candidate-written comments elsewhere remain valid evidence.
  const sectionLines = section.split("\n");
  const templateLines = templateSection.split("\n");
  let prefixLength = 0;
  while (prefixLength < templateLines.length && sectionLines[prefixLength]?.trim() === templateLines[prefixLength].trim()) prefixLength += 1;
  return prefixLength ? sectionLines.slice(prefixLength).join("\n").trim() : section.trim();
}

function getCandidateAnswer(answer: string, step: number, problem?: Problem) {
  // Keep candidate-written comments as evidence. Only the protected editor
  // instructions are removed before the answer is sent to the evaluator.
  const section = removeProtectedInstructions(getCurrentSection(answer, step));
  return problem ? removeLegacyTemplateInstructions(section, problem, step) : section;
}
function normalizeAnswerInstructions(answer: string, problem: Problem) {
  if (answer.includes(instructionStart)) return answer;
  const sections = sectionMarkers.map((marker, index) => {
    if (!answer.includes(marker)) return "";
    const candidate = getCandidateAnswer(answer, index, problem);
    return `${getSectionTemplate(problem, index)}${candidate ? `\n\n${candidate}` : ""}`;
  }).filter(Boolean);
  return sections.join("\n\n") || getStarter(problem);
}
function scoreClass(score: string) { return `score-${score.toLowerCase().replaceAll(" ", "-")}`; }

export default function Home() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [savedPractices, setSavedPractices] = useState<SavedPractice[]>([]);
  const [selected, setSelected] = useState<Problem | null>(null);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [answer, setRawAnswer] = useState("");
  const [tab, setTab] = useState<Tab>("answer");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [stepScores, setStepScores] = useState<Record<number, string>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      window.location.replace("/login");
      return;
    }
    const supabase = createClient();
    let mounted = true;
    async function loadUser() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setUserId(data.session.user.id);
      setUserEmail(data.session.user.email || "");
      setAuthReady(true);
      const { data: practices } = await supabase.from("practices").select("*").order("updated_at", { ascending: false });
      if (mounted) setSavedPractices((practices || []) as SavedPractice[]);
    }
    loadUser();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) router.replace("/login");
    });
    return () => { mounted = false; authListener.subscription.unsubscribe(); };
  }, [router]);

  function setAnswer(value: string | ((current: string) => string)) {
    setRawAnswer((current) => typeof value === "function" ? value(current) : value);
    setFeedback(null);
    setError("");
  }
  function openProblem(problem: Problem) {
    setPracticeId(null); setSaveStatus("idle");
    setSelected(problem); setStep(0); setAnswer(getStarter(problem)); setTab("answer"); setFeedback(null); setStepScores({});
    setChatMessages([{ role: "assistant", content: `I’m the interviewer for ${problem.title}. Ask me a focused clarifying question about the problem.` }]);
    setQuestion(""); setChatError(""); setFollowUpQuestion(""); setFollowUpError(""); setError("");
  }
  function openSavedPractice(problem: Problem, saved: SavedPractice) {
    const restoredStep = Math.min(saved.current_step, steps.length - 1);
    const restoredAnswer = normalizeAnswerInstructions(saved.answer || getStarter(problem), problem);
    const restoredCandidate = getCandidateAnswer(restoredAnswer, restoredStep, problem);
    const restoredScores = { ...(saved.step_scores || {}) };
    if (!restoredCandidate) delete restoredScores[restoredStep];
    setPracticeId(saved.id); setSaveStatus("idle"); setSelected(problem); setStep(restoredStep);
    setAnswer(restoredAnswer); setTab("answer"); setFeedback(restoredCandidate ? saved.feedback : null); setStepScores(restoredScores);
    setChatMessages([{ role: "assistant", content: `I’m the interviewer for ${problem.title}. Ask me a focused clarifying question about the problem.` }]);
    setQuestion(""); setChatError(""); setFollowUpQuestion(saved.follow_up_question || ""); setFollowUpError(""); setError("");
  }
  async function saveProgress(elapsedSeconds: number) {
    if (!userId || !selected) return;
    setSaveStatus("saving");
    const supabase = createClient();
    const payload = { user_id: userId, problem_id: selected.id, problem_title: selected.title, difficulty: selected.difficulty, current_step: step, answer, step_scores: stepScores, feedback, follow_up_question: followUpQuestion || null, timer_seconds: elapsedSeconds, completed: false, updated_at: new Date().toISOString() };
    try {
      if (practiceId) {
        const { error: updateError } = await supabase.from("practices").update(payload).eq("id", practiceId);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase.from("practices").insert(payload).select().single();
        if (insertError) throw insertError;
        setPracticeId(data.id);
      }
      const { data: practices } = await supabase.from("practices").select("*").order("updated_at", { ascending: false });
      setSavedPractices((practices || []) as SavedPractice[]);
      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus("idle"), 1800);
    } catch (e) {
      console.error("Saving practice failed", e);
      setSaveStatus("error");
    }
  }
  async function deletePractice(savedPracticeId: string) {
    if (!userId || !window.confirm("Delete this saved practice? This cannot be undone.")) return;
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("practices").delete().eq("id", savedPracticeId);
    if (deleteError) return;
    setSavedPractices((current) => current.filter((practice) => practice.id !== savedPracticeId));
  }
  async function logOut() {
    await createClient().auth.signOut();
    router.replace("/login");
  }
  async function deleteAccount() {
    if (!window.confirm("Delete your account and all saved practices? This cannot be undone.")) return;
    const response = await fetch("/api/account", { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      window.alert(payload.error || "Could not delete your account.");
      return;
    }
    await createClient().auth.signOut();
    router.replace("/login");
  }
  async function goBack(elapsedSeconds = 0) {
    if (step > 0) { setStep(step - 1); setTab("answer"); setFeedback(null); setError(""); }
    else await exitPractice(elapsedSeconds);
  }
  async function skipStep(elapsedSeconds = 0) {
    if (!selected) return;
    if (step < steps.length - 1) { setAnswer((current) => revealStep(current, selected, step + 1)); setStep(step + 1); setTab("answer"); setFeedback(null); setError(""); }
    else await exitPractice(elapsedSeconds);
  }
  async function nextStep(elapsedSeconds = 0) {
    if (!selected || !stepScores[step]) return;
    if (step < steps.length - 1) { setAnswer((current) => revealStep(current, selected, step + 1)); setStep(step + 1); setTab("answer"); setFeedback(null); setError(""); }
    else await exitPractice(elapsedSeconds);
  }
  async function exitPractice(elapsedSeconds = 0) {
    if (selected) await saveProgress(elapsedSeconds);
    setSelected(null); setPracticeId(null); setSaveStatus("idle");
  }

  async function askClarifyingQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || step !== 0 || !question.trim() || chatLoading) return;
    const submittedQuestion = question.trim();
    setQuestion(""); setChatError(""); setChatMessages((current) => [...current, { role: "user", content: submittedQuestion }]); setChatLoading(true);
    try {
      const response = await fetch("/api/clarify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ problem: selected.title, difficulty: selected.difficulty, masteryPrompt: formatMasteryContext(selected.title), question: submittedQuestion, history: chatMessages.slice(-8) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The interviewer could not respond.");
      setChatMessages((current) => [...current, { role: "assistant", content: payload.answer }]);
    } catch (e) { setChatError(e instanceof Error ? e.message : "The interviewer could not respond."); }
    finally { setChatLoading(false); }
  }
  async function askForFeedback() {
    if (!selected) return;
    const currentSection = getCandidateAnswer(answer, step, selected);
    // Empty sections are graded deterministically as RED by the API.
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ problem: selected.title, difficulty: selected.difficulty, step: steps[step], stepPrompt: getStepPrompt(selected, steps[step], followUpQuestion), answer: currentSection }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Feedback failed.");
      setFeedback(payload.feedback); setStepScores((current) => ({ ...current, [step]: payload.feedback.score })); setTab("feedback");
    } catch (e) { setError(e instanceof Error ? e.message : "Feedback failed."); setTab("feedback"); }
    finally { setLoading(false); }
  }
  async function generateFollowUp() {
    if (!selected || followUpLoading) return;
    setFollowUpLoading(true); setFollowUpError("");
    try {
      const response = await fetch("/api/followup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ problem: selected.title, difficulty: selected.difficulty, masteryPrompt: formatMasteryContext(selected.title), answer }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The AI interviewer could not create a follow-up.");
      setFollowUpQuestion(payload.question);
    } catch (e) { setFollowUpError(e instanceof Error ? e.message : "The AI interviewer could not create a follow-up."); }
    finally { setFollowUpLoading(false); }
  }

  if (!authReady) return <main className="auth-loading"><span>{isSupabaseConfigured() ? "Checking your login…" : "Redirecting to login…"}</span><a href="/login">Continue to login</a></main>;
  if (!selected) return <Catalog onSelect={openProblem} onResume={openSavedPractice} onDelete={deletePractice} onLogout={logOut} onDeleteAccount={deleteAccount} userEmail={userEmail} savedPractices={savedPractices} />;
  return <Practice selected={selected} step={step} answer={answer} setAnswer={setAnswer} tab={tab} setTab={setTab} feedback={feedback} error={error} loading={loading} stepScores={stepScores} chatMessages={chatMessages} question={question} setQuestion={setQuestion} chatLoading={chatLoading} chatError={chatError} askClarifyingQuestion={askClarifyingQuestion} followUpQuestion={followUpQuestion} followUpLoading={followUpLoading} followUpError={followUpError} generateFollowUp={generateFollowUp} goBack={goBack} skipStep={skipStep} nextStep={nextStep} exitPractice={exitPractice} askForFeedback={askForFeedback} saveProgress={saveProgress} saveStatus={saveStatus} initialElapsedSeconds={practiceId ? savedPractices.find((practice) => practice.id === practiceId)?.timer_seconds || 0 : 0} />;
}

function Catalog({ onSelect, onResume, onDelete, onLogout, onDeleteAccount, userEmail, savedPractices }: { onSelect: (problem: Problem) => void; onResume: (problem: Problem, practice: SavedPractice) => void; onDelete: (practiceId: string) => void; onLogout: () => Promise<void>; onDeleteAccount: () => Promise<void>; userEmail: string; savedPractices: SavedPractice[] }) {
  const [difficulty, setDifficulty] = useState<"All" | "Easy" | "Medium" | "Hard">("All");
  const [search, setSearch] = useState("");
  const [expandedProblemId, setExpandedProblemId] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const filtered = problems.filter((problem) => (difficulty === "All" || problem.difficulty === difficulty) && problem.title.toLowerCase().includes(search.toLowerCase().trim()));
 return <main className="catalog-shell"><header className="catalog-header"><div className="brand"><span>✦</span> master<span className="brand-accent">lld</span></div><div className="account-menu"><button className="account-button" onClick={() => setAccountOpen((current) => !current)} aria-label="Open account menu" aria-expanded={accountOpen}><span className="account-icon">{userEmail ? userEmail.charAt(0).toUpperCase() : "U"}</span></button>{accountOpen && <div className="account-popover"><span className="account-email">{userEmail}</span><button onClick={onLogout}>Log out</button><button className="account-danger" onClick={onDeleteAccount}>Delete account</button></div>}</div></header><section className="catalog-content"><div className="catalog-intro"><div><p className="overline">THE PRACTICE ROOM</p><h1>Choose a problem.<br /><em>Think in objects.</em></h1><p>Work through common low-level design prompts one step at a time, then get thoughtful feedback on your answer.</p></div><div className="catalog-stats"><div><strong>{problems.length}</strong><span>problems</span></div></div></div><div className="catalog-toolbar"><div><h2>Practice problems</h2><p>Pick a prompt to start a focused design session.</p></div><div className="catalog-controls"><label className="search-box"><span>⌕</span><input aria-label="Search problems by title" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title" /></label><div className="difficulty-toggle" role="group" aria-label="Filter by difficulty">{(["All", "Easy", "Medium", "Hard"] as const).map((option) => <button key={option} className={difficulty === option ? "selected" : ""} onClick={() => setDifficulty(option)}>{option}</button>)}</div></div></div>{filtered.length ? <div className="problem-grid">{filtered.map((problem) => { const practices = savedPractices.filter((saved) => saved.problem_id === problem.id); const expanded = expandedProblemId === problem.id && practices.length > 0; return <div className={`problem-entry ${expanded ? "expanded" : ""}`} key={problem.id}><button className="problem-card" onClick={() => practices.length ? setExpandedProblemId(expanded ? null : problem.id) : onSelect(problem)}><div className={`problem-icon ${problem.tone}`}>{problem.icon}</div><div className="problem-card-copy"><div className="problem-card-title"><strong>{problem.title}</strong><span className={`difficulty ${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span></div><p>{problem.description}</p><small>◷ {problem.time}{practices.length ? ` · ${practices.length} practice${practices.length === 1 ? "" : "s"}` : ""}</small></div><span className="card-arrow">{practices.length ? expanded ? "⌃" : "⌄" : "›"}</span></button>{expanded && <div className="practice-history"><div className="history-header"><strong>Your practices</strong><button className="new-practice" onClick={() => onSelect(problem)}>Start new practice</button></div>{practices.map((practice) => <div className="history-row" key={practice.id}><div><strong>{new Date(practice.updated_at).toLocaleDateString()}</strong><span>{practice.completed ? "Completed" : `Step ${Math.min(practice.current_step + 1, steps.length)} of ${steps.length}`}</span></div><div className="history-progress">{steps.map((label, index) => <span className={`history-dot ${practice.step_scores?.[index] ? scoreClass(practice.step_scores[index]) : ""}`} title={label} key={label} />)}</div><div className="history-actions"><button className="history-action" onClick={() => onResume(problem, practice)}>{practice.completed ? "View" : "Resume"}</button><button className="history-delete" onClick={() => onDelete(practice.id)} aria-label={`Delete ${problem.title} practice from ${new Date(practice.updated_at).toLocaleDateString()}`}>Delete</button></div></div>)}</div>}</div>; })}</div> : <div className="empty-results"><strong>No matching problems</strong><p>Try another title or difficulty.</p></div>}</section></main>;
}

function StepChecklist({ step, problem }: { step: string; problem: Problem }) {
  const checklists: Record<string, { title: string; items: string[] }> = {
    Requirements: { title: "Prompt the AI or interviewer", items: [`What are the primary operations for ${problem.title}?`, "What rules define success, failure, and completion?", "What should be explicitly out of scope?"] },
    Entities: { title: "Map the system shape", items: ["Which nouns maintain changing state?", "Which object orchestrates the main workflow?", "Who owns each relationship and rule?"] },
    "Class design": { title: "Derive state and behavior", items: ["What state must each entity remember?", "Which public methods satisfy the requirements?", "Where should each rule be enforced?"] },
    Implementation: { title: "Trace the core operation", items: [getStepPrompt(problem, "Implementation"), "Show the happy path and the state changes.", "Handle invalid inputs and important edge cases explicitly."] },
    Extensibility: { title: "Handle one follow-up", items: ["Ask the AI for one meaningful change in requirements.", "Identify the class, relationship, or API that changes.", "Explain what stays stable and the trade-off."] },
  };
  const checklist = checklists[step];
  return <div className="coach-card-body"><strong>{checklist.title}</strong><ul>{checklist.items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

function ExtensibilityPrompt({ problem, question, loading, error, onGenerate }: { problem: Problem; question: string; loading: boolean; error: string; onGenerate: () => void }) {
  return <div className="followup-panel"><div className="followup-heading"><strong>AI interviewer follow-up</strong><span>One question</span></div>{question ? <p className="followup-question">{question}</p> : <p className="followup-placeholder">Generate a realistic change to the {problem.title} requirements, then answer it in the editor.</p>}<button className="followup-button" onClick={onGenerate} disabled={loading}>{loading ? "Creating follow-up…" : question ? "Generate another" : "Generate follow-up"}</button>{error && <p className="chat-error">{error}</p>}</div>;
}

function QuestionChat({ problem, messages, question, setQuestion, loading, error, onSubmit }: { problem: Problem; messages: ChatMessage[]; question: string; setQuestion: (value: string) => void; loading: boolean; error: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="question-chat"><div className="chat-messages" aria-live="polite">{messages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? "AI interviewer" : "You"}</span><p>{message.content}</p></div>)}{loading && <div className="chat-message assistant"><span>AI interviewer</span><p className="typing">Thinking…</p></div>}</div><form className="chat-form" onSubmit={onSubmit}><textarea aria-label={`Ask a clarifying question about ${problem.title}`} placeholder="Ask a clarifying question…" value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} disabled={loading} /><button className="chat-submit" type="submit" disabled={loading || !question.trim()}>Ask AI <span>↵</span></button></form>{error && <p className="chat-error">{error}</p>}</div>;
}

function isInstructionLine(line: string) {
  return line.trimStart().startsWith("#");
}

function isInstructionFence(line: string) {
  const trimmed = line.trim();
  return trimmed === instructionStart || trimmed === instructionEnd;
}

function getProtectedLineIndexes(value: string) {
  const lines = value.split("\n");
  const protectedIndexes = new Set<number>();
  const hasFences = lines.some(isInstructionFence);
  if (!hasFences) {
    lines.forEach((line, index) => { if (isInstructionLine(line)) protectedIndexes.add(index); });
    return protectedIndexes;
  }

  let protectedBlock = false;
  lines.forEach((line, index) => {
    if (isInstructionFence(line)) {
      protectedIndexes.add(index);
      protectedBlock = line.trim() === instructionStart;
    } else if (protectedBlock) {
      protectedIndexes.add(index);
    }
  });
  return protectedIndexes;
}

function normalizeProtectedBlocks(nextValue: string, previousValue: string) {
  if (!previousValue.includes(instructionStart)) return nextValue;
  const previousLines = previousValue.split("\n");
  const protectedIndexes = getProtectedLineIndexes(previousValue);
  const blocks: string[][] = [];
  let block: string[] = [];
  previousLines.forEach((line, index) => {
    if (!protectedIndexes.has(index)) return;
    block.push(line);
    if (line.trim() === instructionEnd) {
      blocks.push(block);
      block = [];
    }
  });
  if (!blocks.length) return nextValue;

  const nextLines = nextValue.split("\n");
  const restored: string[] = [];
  let cursor = 0;
  for (const protectedBlock of blocks) {
    let firstMatch = -1;
    let lastMatch = -1;
    let searchFrom = cursor;
    for (const protectedLine of protectedBlock) {
      const match = nextLines.findIndex((line, index) => index >= searchFrom && line === protectedLine);
      if (match < 0) return nextValue;
      if (firstMatch < 0) firstMatch = match;
      lastMatch = match;
      searchFrom = match + 1;
    }
    restored.push(...nextLines.slice(cursor, firstMatch), ...protectedBlock);
    cursor = lastMatch + 1;
  }
  restored.push(...nextLines.slice(cursor));
  return restored.join("\n");
}

function protectInstructions(nextValue: string, previousValue: string) {
  const previousLines = previousValue.split("\n");
  const protectedIndexes = getProtectedLineIndexes(previousValue);
  const protectedLines = previousLines.filter((_, index) => protectedIndexes.has(index));
  if (!protectedLines.length) return nextValue;

  const nextLines = nextValue.split("\n");
  const matches: Array<number | null> = [];
  let searchFrom = 0;
  for (const protectedLine of protectedLines) {
    const match = nextLines.findIndex((line, index) => index >= searchFrom && line === protectedLine);
    matches.push(match >= 0 ? match : null);
    if (match >= 0) searchFrom = match + 1;
  }
  if (matches.every((match) => match !== null)) return normalizeProtectedBlocks(nextValue, previousValue);
  if (matches.every((match) => match === null)) return normalizeProtectedBlocks(`${protectedLines.join("\n")}\n${nextValue}`.trimEnd(), previousValue);

  const insertBefore = new Map<number, string[]>();
  const insertAfter = new Map<number, string[]>();
  protectedLines.forEach((protectedLine, index) => {
    if (matches[index] !== null) return;
    const nextMatch = matches.slice(index + 1).find((match) => match !== null);
    const previousMatch = matches.slice(0, index).reverse().find((match) => match !== null);
    if (nextMatch !== undefined) {
      const lines = insertBefore.get(nextMatch as number) || [];
      lines.push(protectedLine);
      insertBefore.set(nextMatch as number, lines);
    } else if (previousMatch !== undefined) {
      const lines = insertAfter.get(previousMatch as number) || [];
      lines.push(protectedLine);
      insertAfter.set(previousMatch as number, lines);
    }
  });

  const restored: string[] = [];
  nextLines.forEach((line, index) => {
    if (insertBefore.has(index)) restored.push(...(insertBefore.get(index) || []));
    restored.push(line);
    if (insertAfter.has(index)) restored.push(...(insertAfter.get(index) || []));
  });
  return normalizeProtectedBlocks(restored.join("\n"), previousValue);
}

function Practice({ selected, step, answer, setAnswer, tab, setTab, feedback, error, loading, stepScores, chatMessages, question, setQuestion, chatLoading, chatError, askClarifyingQuestion, followUpQuestion, followUpLoading, followUpError, generateFollowUp, goBack, skipStep, nextStep, exitPractice, askForFeedback, saveProgress, saveStatus, initialElapsedSeconds }: { selected: Problem; step: number; answer: string; setAnswer: (value: string) => void; tab: Tab; setTab: (tab: Tab) => void; feedback: Feedback | null; error: string; loading: boolean; stepScores: Record<number, string>; chatMessages: ChatMessage[]; question: string; setQuestion: (value: string) => void; chatLoading: boolean; chatError: string; askClarifyingQuestion: (event: FormEvent<HTMLFormElement>) => void; followUpQuestion: string; followUpLoading: boolean; followUpError: string; generateFollowUp: () => void; goBack: (elapsedSeconds?: number) => Promise<void>; skipStep: (elapsedSeconds?: number) => Promise<void>; nextStep: (elapsedSeconds?: number) => Promise<void>; exitPractice: (elapsedSeconds?: number) => Promise<void>; askForFeedback: () => void; saveProgress: (elapsedSeconds: number) => Promise<void>; saveStatus: "idle" | "saving" | "saved" | "error"; initialElapsedSeconds: number }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsedSeconds);
  const [timerRunning, setTimerRunning] = useState(false);
  const [language, setLanguage] = useState("Python");
  const [languageOpen, setLanguageOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [editorScrollTop, setEditorScrollTop] = useState(0);
  const lastSafeAnswer = useRef(answer);

  useEffect(() => {
    const safeAnswer = protectInstructions(answer, lastSafeAnswer.current);
    if (safeAnswer !== answer) {
      setAnswer(safeAnswer);
      return;
    }
    lastSafeAnswer.current = answer;
  }, [answer, setAnswer]);

  useEffect(() => {
    if (!timerRunning) return;
    const timer = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);
  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const lines = answer.split("\n");
    const protectedIndexes = getProtectedLineIndexes(answer);
    const startLine = answer.slice(0, start).split("\n").length - 1;
    const endLine = answer.slice(0, Math.max(start, end - 1)).split("\n").length - 1;
    const touchesInstruction = Array.from({ length: endLine - startLine + 1 }, (_, offset) => protectedIndexes.has(startLine + offset)).some(Boolean);
    const lineStart = answer.lastIndexOf("\n", start - 1) + 1;
    const lineEndIndex = answer.indexOf("\n", start);
    const lineEnd = lineEndIndex < 0 ? answer.length : lineEndIndex;
    const hasSelection = start !== end;
    const currentLine = lines[startLine] || "";
    const safeNewlineBoundary = !hasSelection && event.key === "Enter" && ((start === lineEnd && currentLine.trim() === instructionEnd) || (start === lineStart && currentLine.trim() === instructionStart));
    const atInstructionBoundary = !hasSelection && ((event.key === "Backspace" && start === lineStart && startLine > 0 && protectedIndexes.has(startLine - 1)) || (event.key === "Delete" && start === lineEnd && protectedIndexes.has(startLine + 1)));
    const editingKey = event.key.length === 1 || ["Backspace", "Delete", "Enter", "Tab"].includes(event.key);
    if (editingKey && ((touchesInstruction && !safeNewlineBoundary) || atInstructionBoundary)) {
      event.preventDefault();
      return;
    }
    if (event.key !== "Tab") return;
    event.preventDefault();
    const indent = "  ";
    if (event.shiftKey && answer.slice(Math.max(0, start - indent.length), start) === indent) {
      setAnswer(`${answer.slice(0, start - indent.length)}${answer.slice(end)}`);
      window.requestAnimationFrame(() => { target.selectionStart = start - indent.length; target.selectionEnd = start - indent.length; });
      return;
    }
    setAnswer(`${answer.slice(0, start)}${indent}${answer.slice(end)}`);
    window.requestAnimationFrame(() => { target.selectionStart = start + indent.length; target.selectionEnd = start + indent.length; });
  }

  const elapsedLabel = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`;
  const guidance = stepGuidance[steps[step] as keyof typeof stepGuidance];
  // Empty submissions are allowed so the deterministic RED response can be
  // shown instead of leaving stale or generic feedback on screen.
  const hasCandidateAnswer = true;
  const canAdvance = Boolean(stepScores[step]);
  const protectedIndexes = getProtectedLineIndexes(answer);
  const highlightedLines = answer.split("\n").map((line, index) => <span className={protectedIndexes.has(index) ? "protected-line" : "answer-line"} key={`${index}-${line}`}>{line || " "}{"\n"}</span>);

  return <main className="practice-shell"><aside className="coach-panel"><div className="coach-top"><span className="top-spacer" aria-hidden="true" /><div className="step-dots">{steps.map((label, index) => { const score = stepScores[index]; return <span className={`step-dot ${score ? scoreClass(score) : ""}`} title={`${label}${score ? `: ${score}` : ""}`} key={label} />; })}</div><span className="top-spacer" aria-hidden="true" /></div><div className="coach-content"><span className="step-chip">{steps[step]}</span><h2>{guidance.title}</h2><p className="coach-copy">{guidance.copy}</p><div className="coach-card"><div className="coach-tabs"><button className={tab === "answer" ? "active" : ""} onClick={() => setTab("answer")}>To Answer</button>{step === 0 && <button className={tab === "questions" ? "active" : ""} onClick={() => setTab("questions")}>Ask Questions</button>}<button className={tab === "feedback" ? "active teal" : "teal"} onClick={() => setTab("feedback")}>Feedback</button><button className={tab === "suggestions" ? "active" : ""} onClick={() => setTab("suggestions")}>Suggestions</button></div>{tab === "answer" && <>{<StepChecklist step={steps[step]} problem={selected} />}{step === 4 && <ExtensibilityPrompt problem={selected} question={followUpQuestion} loading={followUpLoading} error={followUpError} onGenerate={generateFollowUp} />}</>}{tab === "questions" && step === 0 && <QuestionChat problem={selected} messages={chatMessages} question={question} setQuestion={setQuestion} loading={chatLoading} error={chatError} onSubmit={askClarifyingQuestion} />}{tab === "feedback" && <FeedbackPanel feedback={hasCandidateAnswer ? feedback : null} error={error} problem={selected.title} step={steps[step]} />}{tab === "suggestions" && <SuggestionsPanel feedback={hasCandidateAnswer ? feedback : null} error={error} problem={selected.title} step={steps[step]} />}</div></div><div className="coach-footer"><button className="feedback-button coach-feedback-button" disabled={loading || !hasCandidateAnswer} onClick={askForFeedback}>{loading ? "Reviewing…" : "Get AI feedback"} <span>⌘ ↵</span></button><div className="coach-save-row"><button className="save-progress" onClick={() => saveProgress(elapsedSeconds)} disabled={saveStatus === "saving"}>{saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Progress saved" : saveStatus === "error" ? "Try saving again" : "Save progress"}</button><span className="save-hint">{saveStatus === "error" ? "Couldn’t save" : ""}</span></div><div className="coach-nav"><button className="secondary" onClick={() => goBack(elapsedSeconds)}>{step === 0 ? "Back to Problems" : "Previous Step"}</button><button className="skip-button" onClick={() => skipStep(elapsedSeconds)}>{step === steps.length - 1 ? "Skip & Exit" : "Skip Step"} <span>›</span></button><button className="primary next-button" onClick={() => nextStep(elapsedSeconds)} disabled={!canAdvance}>{step === steps.length - 1 ? "Finish" : "Next Step"} <span>›</span></button></div></div></aside><section className="editor-panel"><header className="editor-top"><div className="problem-title"><h1>Design a {selected.title}</h1><button className={`info ${infoOpen ? "active" : ""}`} onClick={() => setInfoOpen((current) => !current)} aria-label={`Show ${selected.title} problem description`} aria-expanded={infoOpen}>i</button></div><div className="editor-actions"><button className={`clock ${timerRunning ? "active" : ""}`} onClick={() => setTimerRunning((current) => !current)} aria-label={timerRunning ? "Pause stopwatch" : "Start stopwatch"} aria-pressed={timerRunning}>◷ <span className="timer-label">{elapsedLabel}</span></button><button className="timer-reset" onClick={() => { setTimerRunning(false); setElapsedSeconds(0); }} aria-label="Reset stopwatch" disabled={!timerRunning && elapsedSeconds === 0}>↺</button><span className="divider" /><div className="language-picker"><button className="language-button" onClick={() => setLanguageOpen((current) => !current)} aria-label="Choose code language" aria-expanded={languageOpen}>{language} <span className="chevron">⌄</span></button>{languageOpen && <div className="language-menu" role="menu">{["Python", "Java", "C++"].map((option) => <button key={option} role="menuitem" className={language === option ? "selected" : ""} onClick={() => { setLanguage(option); setLanguageOpen(false); }}>{option}</button>)}</div>}</div><button className="exit" onClick={() => exitPractice(elapsedSeconds)} aria-label="Exit practice">← Exit</button></div>{infoOpen && <div className="problem-info-panel" role="dialog" aria-label={`${selected.title} problem description`}><strong>Problem brief</strong><h3>Design a {selected.title}</h3><p>{getMasteryPrompt(selected.title).brief}</p><span>Current step: {steps[step]}</span></div>}</header><div className="editor-wrap"><div className="line-numbers" style={{ transform: `translateY(-${editorScrollTop}px)` }}>{Array.from({ length: Math.max(18, answer.split("\n").length) }, (_, index) => <span key={index}>{index + 1}</span>)}</div><div className="editor-code"><pre className="editor-highlight" aria-hidden="true" style={{ transform: `translateY(-${editorScrollTop}px)` }}>{highlightedLines}</pre><textarea className="editor-input" aria-label="Your answer" value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={handleEditorKeyDown} onScroll={(event) => setEditorScrollTop(event.currentTarget.scrollTop)} spellCheck={false} /></div></div><footer className="editor-bottom"><span>{answer.length} characters</span><span className="section-status">AI reviews {steps[step]} only</span><span className="editor-hint">Use the left panel for feedback</span></footer></section></main>;
}

const stepGuidance = {
  Requirements: { title: <>Turn the prompt into<br />a clear contract.</>, copy: "Ask the AI or interviewer focused clarifying questions about capabilities, rules, errors, and scope. Record only the requirements that have been confirmed." },
  Entities: { title: <>Find the objects<br />that own the behavior.</>, copy: "Translate the confirmed requirements into a small set of entities. Explain which object owns each piece of state and how the objects collaborate." },
  "Class design": { title: <>Shape the state<br />and public behavior.</>, copy: "Turn each entity into a class outline with the state it must remember and the methods other objects need. Keep rules close to the state they protect." },
  Implementation: { title: <>Make the core flow<br />executable.</>, copy: "Implement the primary operation in readable pseudocode or Python. Walk through the happy path first, then handle the most important invalid inputs and state transitions." },
  Extensibility: { title: <>Push the design<br />without breaking it.</>, copy: "Ask the AI for one realistic follow-up. Explain the smallest design change, what stays stable, and the trade-off it introduces." },
};

function FeedbackPanel({ feedback, error, problem, step }: { feedback: Feedback | null; error: string; problem: string; step: string }) {
  if (error) return <div className="coach-card-body error"><strong>Couldn’t review this yet</strong><p>{error}</p></div>;
  if (!feedback) return <div className="coach-card-body"><strong>AI feedback</strong><p>Submit your answer to get an encouraging, specific review of your {problem} {step.toLowerCase()} response.</p></div>;
  const labels: Record<string, string> = { RED: "Needs a reset", ORANGE: "Needs work", "LIGHT GREEN": "Good, needs work", "DARK GREEN": "Interview ready" };
  return <div className="coach-card-body feedback-result"><div className="feedback-context">{problem} · {step} feedback</div><div className="score-row"><strong><span className={`feedback-score-dot ${scoreClass(feedback.score)}`} aria-hidden="true" />{labels[feedback.score] || "Reviewed"}</strong></div><p>{feedback.summary}</p><strong>What went well</strong>{feedback.strengths.map((item) => <p className="feedback-item" key={item}>● {item}</p>)}{feedback.gaps.length > 0 && <><strong>What needs improvement</strong><p className="feedback-item improvement-item">● {feedback.gaps[0]}</p></>}{feedback.gaps.length > 1 && <><strong>Minor suggestions</strong>{feedback.gaps.slice(1).map((item) => <p className="feedback-item" key={item}>● {item}</p>)}</>}<strong>Next step</strong><p>{feedback.nextImprovement}</p></div>;
}

function SuggestionsPanel({ feedback, error, problem, step }: { feedback: Feedback | null; error: string; problem: string; step: string }) {
  if (error) return <div className="coach-card-body error"><strong>Suggestions unavailable</strong><p>{error}</p></div>;
  if (!feedback) return <div className="coach-card-body"><strong>Suggestions</strong><p>Submit your answer first. Suggestions will be based on your response to this {problem} {step.toLowerCase()} section.</p></div>;
  if (!Array.isArray(feedback.suggestions)) return <div className="coach-card-body"><strong>Suggestions need a fresh review</strong><p>Run AI feedback again to generate suggestions tailored to this response.</p></div>;
  const suggestions = feedback.suggestions;
  if (!suggestions.length) return <div className="coach-card-body"><strong>Suggestions</strong><p>No additional changes are needed for this section.</p></div>;
  return <div className="coach-card-body suggestions-result"><div className="feedback-context">{problem} · {step} suggestions</div><strong>What your response should include</strong><ul className="suggestion-list">{suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}</ul></div>;
}
