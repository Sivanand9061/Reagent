# Reagent Code Academy — Refined System Architecture & UX Flow Specification

*v2 Draft — Implementation-ready*

Prepared as a working spec to implement directly against the existing Firebase + Express + React codebase. No new infrastructure required beyond what's already in place, except where explicitly flagged in Section 8 (future language support).

## Table of Contents

1. [Why this refactor](#1-why-this-refactor)
2. [Current state — what to keep, what to fix](#2-current-state--what-to-keep-what-to-fix)
3. [The Session Context spine](#3-the-session-context-spine)
4. [Refined feature specification](#4-refined-feature-specification)
5. [End-to-end UX flow](#5-end-to-end-ux-flow)
6. [Final Firestore schema](#6-final-firestore-schema)
7. [API endpoint map](#7-api-endpoint-map)
8. [Multi-language support — deferred, but designed for](#8-multi-language-support--deferred-but-designed-for)
9. [Implementation order](#9-implementation-order)

---

## 1. Why this refactor

The four existing pipelines — Career Roadmap, Code Submission, Document Grounding (RAG), and Activity Log — are each independently well-built. The problem isn't quality, it's connection. Each pipeline reads and writes its own corner of Firestore, and none of them are aware of what the others know about the user. The AI Mentor chat doesn't know the user's skill level. The Quiz doesn't know what the user actually struggled with. The Roadmap and the Code Critique are unaware of each other mid-session.

This is what produces the feeling of "everything is cluttered and doesn't connect." It isn't a feature count problem. It's a missing spine.

> **The fix in one sentence:** Introduce a single shared Session Context object that every AI-facing feature reads from before responding and writes to after producing a result. One shape, many consumers, instead of four independent islands.

This document covers, in order: the new data spine (Section 3), the refined behavior of each feature (Section 4), the full end-to-end UX flow for a new and a returning user (Section 5), the final Firestore schema (Section 6), the API surface (Section 7), a deliberately deferred plan for multi-language support (Section 8), and a phased rollout order (Section 9).

---

## 2. Current state — what to keep, what to fix

Before changing anything, it's worth being explicit about what's already solid. None of this gets rebuilt.

### Keep as-is

- Firebase Auth + ID token on every request — correct, secure pattern, no changes needed.
- Firebase Admin SDK on the backend for all writes — correct, keeps Firestore rules simple and avoids client trust issues.
- Sandboxed client-side JS execution with intercepted console output — good UX, immediate feedback, no server round-trip for running code.
- RAG document grounding with the 15k-character truncation guard — correctly defends against token blowups.
- Activity log with server-validated timestamps — this is your audit trail and source of truth. Keep writing to it exactly as-is.

### Fix

- No shared context object — each pipeline infers user state independently, or not at all (Quiz pulls from "current challenge," not from the user).
- Pipeline 4 (Activity Log) re-injects up to 40 raw logs into the prompt on every history question — expensive, and still not used by any other feature.
- Quiz format (multiple choice) tests recognition, not the coding ability the rest of the product is built around.
- Language is implicitly JS everywhere — no field captures it, so there's no clean extension point for the future.

---

## 3. The Session Context spine

This is the single most important structural change in this spec. Everything else — the UX flow, the quiz redesign, the language field — hangs off this.

### 3.1 What it is

A single Firestore document per user, kept small and cheap to read, that every AI call reads at the start and every feature updates after producing a result.

```
users/{userId}/context  (single document)
{
  activeNode: {
    moduleId: "fizzbuzz",
    title: "FizzBuzz",
    difficulty: "beginner",
    language: "javascript"        // see Section 8
  },
  skillMap: {
    loops: 0.7,
    recursion: 0.2,
    arrays: 0.5
  },
  recentStruggles: [
    { concept: "loops", detail: "off-by-one", at: <timestamp> },
    { concept: "functions", detail: "forgot return", at: <timestamp> }
  ],
  lastSessionSummary: "Completed sum.js, struggled with edge cases on negative inputs.",
  activeDocument: { docId: "doc123", filename: "react-hooks.pdf" } | null,
  updatedAt: <timestamp>
}
```

### 3.2 Why a single flat document, not a subcollection

Every AI-facing feature needs this data on every call. A single document is one read. A subcollection (e.g. one doc per topic) would mean a query, which is slower and costs more, for data that's small enough to fit in one doc comfortably under Firestore's 1MB limit by orders of magnitude.

### 3.3 Read / write contract per pipeline

| Pipeline | Reads from context | Writes to context | Notes |
|---|---|---|---|
| Roadmap | — (reads skillMap only on regeneration) | activeNode, resets recentStruggles for new module | Only fires on initial generation or module advance |
| Submission | activeNode | skillMap (delta), recentStruggles (append/prune) | Fires on every test run, pass or fail |
| AI Mentor Chat | activeNode, skillMap, recentStruggles, activeDocument | — (chat doesn't mutate context directly) | Read-only consumer; richer than today's RAG-only grounding |
| Micro-Challenge (was Quiz) | activeNode, recentStruggles, skillMap | skillMap (smaller delta weight than main submission) | See Section 4.3.2 |
| Code Critique | skillMap | — | Adjusts depth of explanation only, doesn't mutate state |
| Activity Log | — | lastSessionSummary (on session end) | Raw logs still written every event; summary computed separately |

> **Mechanical rule of thumb:** Any time you're deciding whether a new feature needs some piece of user data, the question becomes binary: is it already in context? If yes, read it. If no, decide if it belongs in context — don't build a one-off fetch.

### 3.4 What does NOT belong in context

- Full code submissions — too large, and not needed by other features. Stays in the exercises subcollection (Section 6).
- Raw activity logs — stays as its own collection for audit/debug. Only the collapsed summary enters context.
- Uploaded document text — stays in the documents subcollection. Context only stores a pointer (docId + filename).

Context is a digest, not a data lake. If a field is making the document large or is only used by one feature, it doesn't belong here.

---

## 4. Refined feature specification

### 4.1 Career Dashboard

Functionally close to its current design. Two behavior changes:

1. On roadmap generation, write activeNode and a language field into context immediately — this is the first point the user's chosen track and language are known, and every downstream feature needs it.
2. The "Dynamic Welcome Greeting" should read lastSessionSummary from context instead of re-deriving from raw activity logs. This turns an expensive, slightly-unpredictable AI summarization step into a cheap field read.

Visual roadmap timeline, node states (completed / in-progress / locked), and the CTA button behavior are unchanged — they already work and don't touch the parts that are tangled.

### 4.2 Code Sandbox Workspace

Largely unchanged. One addition: every test run (pass or fail) should write a structured result — not just to the activity log, but into the Submission pipeline's context update (skillMap delta + recentStruggles), per the contract in 3.3. This is the single wiring change that makes every other feature suddenly "know" what just happened.

> **Concretely:** After Submit & Test resolves, alongside the existing Firestore writes, add one call: `updateContextAfterSubmission(userId, { moduleId, concepts, verdict })`. This function owns the skillMap math — see 4.2.1.

#### 4.2.1 SkillMap update logic (simple, not ML)

Keep this rule-based for v1. For each concept tag associated with the exercise:

- Pass on first attempt: `skillMap[concept] = min(1.0, skillMap[concept] + 0.15)`
- Pass after N failed attempts: `skillMap[concept] = min(1.0, skillMap[concept] + 0.05)`
- Fail: `skillMap[concept] = max(0.0, skillMap[concept] - 0.05)`, and push a recentStruggles entry
- recentStruggles is capped at the most recent 10 entries (FIFO) — this is what keeps the object small and keeps prompts focused on what's current, not a full history

### 4.3 AI Mentor Sidebar

#### 4.3.1 AI Coding Mentor (Chat) — refined

Keep Socratic vs. Direct mode and Casual vs. Formal tone exactly as designed — these are good, low-risk personalization knobs. The change is what gets fed into the prompt:

| Today | Refined |
|---|---|
| Document text (if uploaded) only | Session context (activeNode, skillMap, recentStruggles) + document text if uploaded |
| No awareness of skill level | Socratic hints can be pitched at the user's actual level — a 0.2 skillMap score on recursion gets a more foundational hint than a 0.8 |
| No awareness of recent struggles | If the user's current question touches a concept in recentStruggles, the mentor can proactively connect it ("this is the same off-by-one pattern from your last exercise") |

This is a prompt-construction change only — no new UI, no new endpoint shape, just a richer system/context block built server-side before the call to Gemini.

#### 4.3.2 Practice Quiz → Micro-Challenges (redesign)

> **Decision made:** Replace multiple-choice quiz generation with short, runnable code-completion challenges that execute through the existing sandbox. This was confirmed as the direction in the prior discussion.

Why: multiple-choice tests recognition ("which of these is correct"), not the ability to write code, which is what the rest of the product is built around. It's also currently untargeted — it tests concepts in the active challenge, not the user's actual weak points.

**New behavior:**

1. Generation targets recentStruggles and low-skillMap concepts first, not just "concepts in the active challenge." If there are no struggles yet (new user), fall back to active module concepts.
2. Each micro-challenge is 2-4 lines: a fill-in-the-blank, a "what's wrong with this snippet," or a tiny isolated function — short enough to feel like a quiz, real enough to require actually writing code.
3. Execution reuses the existing sandboxed runtime and test-assertion engine from the Code Sandbox Workspace. No new execution infrastructure.
4. Result feeds skillMap with a smaller weight than a full exercise (e.g. half the delta in 4.2.1) — it's a pulse check, not a mastery gate, so it shouldn't swing skill scores as hard as completing a real module.

UI-wise, this can stay inside the same "Practice Quiz" tab and visually resemble a quiz (one challenge at a time, a clear pass/fail state, a "Next" button) — the user-facing framing barely changes. What changes is underneath: it's calling the sandbox + a targeted generation prompt instead of an MCQ generator.

#### 4.3.3 Code Critique

Keep Big-O time/space analysis and optimization highlights. Add one read: skillMap. Use it to set explanation depth, not to change correctness of the critique itself:

- Low skillMap on relevant concept: critique leads with a plain-language summary ("this works, but it re-loops over the array — here's a faster way") before the formal Big-O notation.
- High skillMap: lead with the formal complexity analysis, skip the hand-holding.

#### 4.3.4 Syntax Cheat Sheet

No change needed. It's a static reference — it doesn't need context awareness, and trying to personalize a glossary would add complexity for no real benefit. Leave it exactly as built.

---

## 5. End-to-end UX flow

This is what the refined system feels like from the outside, walked through for two cases: a brand-new user, and a returning user. Every step below names which pipeline fires and what touches context, so this section doubles as a trace of the architecture in Sections 3 and 4.

### 5.1 New user, first session

1. User signs up — Firebase Auth creates the account. No context document exists yet.
2. Career Dashboard shows the target-role search bar (empty state, no roadmap yet).
3. User types "AI Engineer" and presses enter → `POST /api/mentor/roadmap` → Roadmap Agent scrapes current job market signals and generates a 4-module curriculum, with a language assigned per module (e.g. Python for AI Engineer, JavaScript for Frontend Developer).
4. Roadmap is saved to `users/{userId}/roadmap/active` AND the context document is created for the first time: activeNode is set to module 1, skillMap is initialized empty, recentStruggles is empty.
5. Dashboard renders the vertical roadmap timeline. Module 1 shows "in progress" (blue), modules 2-4 show "locked" (gray padlock).
6. User clicks the CTA → launches the Code Sandbox Workspace for module 1, with the Lesson Card showing the challenge description.
7. User writes code, clicks Run → executes client-side, console drawer shows output. This loop repeats freely with no Firestore writes — running code is cheap and shouldn't hit the network.
8. User clicks Submit & Test → test suite runs → on pass, Firestore receives two writes: (a) the existing completed-list/mastery update, and (b) the context update — skillMap gets its first values, activeNode advances to module 2 if this was the last exercise in the module.
9. Dashboard timeline updates: module 1 turns green (completed), module 2 turns blue (in progress) — this was already working, now it's also reflected in context for every other feature to see.
10. User opens the AI Mentor sidebar and asks a question. The chat now reads context (activeNode = module 2, skillMap reflecting module-1 performance) before responding, even though the user has never explicitly told the chat anything about their progress.

### 5.2 Returning user, later session

1. User logs in. Context document already exists from prior sessions.
2. Dashboard reads lastSessionSummary and renders the contextual greeting: "Welcome back! Last time you completed sum.js and were starting to explore loops — ready to tackle FizzBuzz?" — this is a field read, not a fresh AI call re-summarizing raw logs.
3. User clicks into the active node. If they ask the AI Mentor "what was I working on yesterday," the response is grounded in lastSessionSummary first; raw activity logs are only pulled if the question is more forensic ("what exact code did I submit at 3pm").
4. User opens Practice Quiz tab. Generation reads recentStruggles first — if the last session flagged an off-by-one loop issue, the first micro-challenge targets that specifically, not a generic question about the current module.
5. User opens Code Critique on a past submission. Because skillMap shows loops at 0.7 (decent) but recursion at 0.2 (weak), and this submission touches recursion, the critique leads with the plain-language explanation before the Big-O formalism.
6. Session ends (logout or timeout) → activity log collapses into a new lastSessionSummary for next time.

> **What changed for the user, concretely:** Nothing in the UI needed to add a single new screen. The dashboard greeting is smarter, the chat is contextually aware without being told, the quiz targets real weak points, and the critique adjusts its tone — all from the same four feature surfaces the user already sees, now wired through one shared spine instead of working in isolation.

---

## 6. Final Firestore schema

Consolidated view of every collection referenced in this spec. Existing collections are marked unchanged; new or modified ones are flagged.

### `users/{userId}`
```
{ email, displayName, createdAt, ... }   // unchanged, owned by Firebase Auth + existing profile fields
```

### `users/{userId}/context/active` — **NEW**

Single document, shape defined in Section 3.1. This is the only new top-level collection introduced by this spec.

### `users/{userId}/roadmap/active` — unchanged shape, one addition
```
{
  targetRole: "AI Engineer",
  modules: [
    { moduleId: "sum", title: "...", status: "completed", language: "python" },  // language field is new
    { moduleId: "fizzbuzz", title: "...", status: "in_progress", language: "python" },
    ...
  ],
  generatedAt
}
```

### `users/{userId}/exercises/{exerciseId}` — unchanged

Full code submissions, test results, timestamps. This is where the existing start/end timestamp data lives — keep exactly as-is. This is the durable record context summarizes from, it is not replaced by context.

### `users/{userId}/challenges/{challengeId}/documents/active` — unchanged

RAG-uploaded document text. Context only stores a pointer to this (docId + filename), not the text itself.

### `users/{userId}/activityLogs/{logId}` — unchanged

Raw event log with server-validated timestamps. Keep writing every event exactly as today. The only addition is a periodic job (on session end, or a scheduled function) that reads recent logs and writes a one-paragraph summary into `context.lastSessionSummary`.

---

## 7. API endpoint map

Existing endpoints, annotated with their new context read/write responsibility. No endpoint paths change — this is about what happens inside each handler.

| Endpoint | Today | Add |
|---|---|---|
| `POST /api/mentor/roadmap` | Generates roadmap, saves to roadmap/active | Also create/update context.activeNode + language; initialize skillMap if new user |
| `POST /api/mentor/user-stats` | Updates completed list + mastery counts | Also call updateContextAfterSubmission() — Section 4.2.1 |
| `POST /api/mentor/upload` | Parses PDF/TXT, saves to documents/active | Also set context.activeDocument pointer |
| `POST /api/mentor/log-activity` | Writes to activityLogs | No change to this call; summary collapse is a separate periodic step, not inline here |
| (chat endpoint, mentor message send) | Fetches document text, truncates, injects into prompt | Also fetch context (one read) and merge into the same prompt-construction step |
| (quiz generation endpoint) | Generates 3 MCQs from active challenge concepts | Replace with micro-challenge generation reading recentStruggles + skillMap (Section 4.3.2); reuses sandbox execution, not a new runner |

New, small endpoint worth adding explicitly:

- `POST /api/mentor/session-end` (or a scheduled Cloud Function) — reads recent activityLogs, generates lastSessionSummary, writes it to context. This is the only genuinely new server-side job in this spec.

---

## 8. Multi-language support — deferred, but designed for

> **Decision:** Do not build Python/C++ execution in this pass. Design the schema so it doesn't block adding it later. This was the explicit tradeoff agreed on: the context spine is the priority; a second execution engine is independent, large scope on its own.

### 8.1 Why this is bigger than a config flag

The current Sandboxed Runtime Console executes code via client-side JavaScript evaluation. This is not a default setting — it is the literal mechanism. It can only ever run JavaScript. Supporting Python or C++ means adding a second execution engine, not changing a value somewhere.

### 8.2 What's already future-proofed by this spec

- `roadmap.modules[].language` and `context.activeNode.language` both exist as real fields from day one (Section 6) — even though only `"javascript"` is ever written into them right now.
- The Roadmap Agent prompt should already ask Gemini to assign a language per module based on the target role, even while only JS execution exists. Worst case today: a Python-track module gets generated with `language: "python"` and the sandbox shows a clear "this language isn't supported yet" state instead of silently running it as JS.

### 8.3 The two real implementation paths, when this is prioritized

| Approach | How it works | Tradeoff |
|---|---|---|
| Pyodide (WASM) | Python compiled to WebAssembly, runs fully client-side, same architecture as today | No backend change, but multi-MB download and a different console-capture mechanism than the current eval-based one |
| Server-side sandbox | Code is sent to a backend execution service (e.g. containerized per-language runners) | Standard approach for true multi-language platforms; adds real backend infrastructure and changes the security model |

Recommendation when this becomes a priority: Pyodide for Python specifically, since it preserves the existing "zero server cost, runs in browser" property. C++ realistically requires server-side execution — there's no practical in-browser C++ compiler/runtime equivalent to Pyodide. If both are wanted, that's the point where server-side sandboxing becomes the unifying answer for non-JS languages generally.

---

## 9. Implementation order

Sequenced so each phase is independently shippable and testable, and so nothing later depends on something not yet built.

### Phase 1 — Build the spine
- Create the context document shape and the read/write helper functions (getContext, updateContextAfterSubmission, etc.)
- Wire context creation into the roadmap generation endpoint
- Wire context update into the existing user-stats/submission endpoint
- No user-visible change yet — this phase is purely plumbing, and should be fully testable by inspecting Firestore directly

### Phase 2 — Make existing features context-aware
- AI Mentor chat reads context before calling Gemini (4.3.1)
- Dashboard greeting reads lastSessionSummary instead of re-summarizing logs (4.1)
- Code Critique reads skillMap to set explanation depth (4.3.3)
- This phase is where the product starts to feel connected, with the least amount of new code

### Phase 3 — Quiz → Micro-Challenge redesign
- Build the targeted-generation prompt (recentStruggles + skillMap → challenge spec)
- Route execution through the existing sandbox/test-runner instead of an MCQ renderer
- This is the largest single feature change in the spec — sequence it after Phases 1-2 so it can read real skillMap/recentStruggles data instead of being built and tested against empty state

### Phase 4 — Session summary job
- Add the session-end summary collapse (Section 7) — lowest priority since lastSessionSummary can safely be blank/fallback-text until this lands

### Phase 5 — Language field plumbing (schema only, Section 8)
- Add language to roadmap generation prompt + schema
- Add a simple "language not yet supported in sandbox" UI state for any non-JS module — this alone removes the silent-failure risk without building a second execution engine

---

## Summary

The existing four pipelines do not need to be rebuilt. They need one shared object between them. Build the context spine first (Phase 1), make the existing chat/dashboard/critique features read from it (Phase 2), then redesign quiz as the one feature that genuinely changes shape (Phase 3). Everything else in this document is sequencing and schema detail in service of that one idea.
