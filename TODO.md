# Saarthi TODO

This checklist is organized so you can build from prototype to MERN + Python AI MVP.

---

## Remediation pass — audit findings resolved

Every confirmed defect group from the code audit and every additional finding has been addressed. Evidence: backend `npm test` 71/71, AI service `pytest` 60/60, `ruff` + ESLint clean, production build green, live smoke test passed against Groq with structured JSON output.

### Security and access control

- [x] **Anonymous auth boundary.** `POST /api/auth/session` mints `user_<uuid>` (crypto random) plus an HS256 token signed with `AUTH_SECRET`. Every user-scoped endpoint reads identity exclusively from `Authorization: Bearer <token>` — the client-supplied `userId` that made trust score, preferences, export and delete readable by anyone is gone.
- [x] **Legacy `/:userId` URLs kept but neutralized.** `requireOwnership` returns 403 when the path/body user id does not match the token's user, so old links cannot be used for cross-user access.
- [x] **Client-controlled trust deltas closed.** `trustScoreDelta` in a request body is rejected with 400; `/api/action-update` derives `+4` / `-1` server-side from the boolean `completed`.
- [x] **Session hijacking closed.** Session upsert is scoped to the authenticated user; presenting another user's `sessionId` returns 409 instead of silently rewriting the session's owner.
- [x] **CORS fixed on both services.** Express wildcard CORS replaced with an explicit origin allow-list plus `helmet` security headers and a JSON body limit; FastAPI's invalid `allow_origins=["*"]` + `allow_credentials=True` pair replaced with an allow-list and `credentials: false`.
- [x] **Rate limiting** on session minting, chat, and preference/action/delete endpoints (per-IP, in-memory; automatically disabled under `NODE_ENV=test` or `RATE_LIMIT_DISABLED=1`).
- [x] **Internal hop authentication** via optional `X-Internal-Api-Key` (`AI_SERVICE_API_KEY` on the backend, `INTERNAL_API_KEY` on the AI service).

### Crisis safety

- [x] **Detection rewritten.** Normalizes leetspeak and spaced-letter input, covers common variants (`kms`, `kys`, `end my life`, `off myself`, `not worth living`, `better off dead`, ...), splits ambiguous phrasings (e.g. bare "end it") from high-confidence ones, and fails safe: literal `suicide` / `kys` escalate even in third-person context.
- [x] **Independent of the model and the AI service.** The backend runs detection *before* calling the AI service and again inside the AI-down fallback path — a user in crisis during an outage now gets an escalation, not a generic reassurance.
- [x] **Parity across services.** The same logic lives in `ai_service/ai_engine.py`, validated by shared test cases on both sides.
- [x] **UI gap closed.** `ChatPage` renders a crisis resources panel (helplines) driven by `risk_flags` instead of discarding them.

### Trust scoring

- [x] **Server-authoritative arithmetic.** Deltas, clamping and phases live in `utils/trustScore.js` + `services/trustService.js`; every change is persisted to `TrustHistory` with a reason (`chat_interaction`, `action_completed`, `crisis_detected`, ...).
- [x] **Baseline mismatch fixed.** The UI no longer seeds 30 against the server's 50, and `TrustCard` bands match the server's phase thresholds, so the phase shown always equals the phase stored.
- [x] **The action endpoint has a real caller.** Chat UI buttons ("I did it" / "Not now") post to `/api/action-update`, so score movement now reflects something the user actually did.
- [x] **Safety invariant tested.** A crisis turn never increases trust, and no single chat turn can move the score to an extreme (0 or 100).
- [ ] Longer term: replace the reply-shape deltas (`+3` supportive reply, `+2` suggested action) with user-signal-only scoring — tracked under the "convincingness scorer" roadmap item below.

### AI service

- [x] **De-duplicated `ai_engine.py`** — the byte-identical second copy (431 lines) is gone; edits are no longer silently discarded by Python's last-definition-wins behaviour.
- [x] **Structured model output.** The model is asked for JSON (`response_format`) against a documented contract in `prompts.py`, validated by Pydantic (`schemas.py`) on the service side and normalized in `services/aiService.js` on the backend side. Text heuristics survive only as the degradation path for unstructured replies, ending the Node-overrides-Python parsing war.
- [x] **CI secrets are consumed.** `config.py` accepts `GROQ_API_BASE_URL` / `GROQ_MODEL` / `GROQ_TEMPERATURE` aliases alongside the local names.
- [x] **Startup hygiene.** Warns clearly when `GROQ_API_KEY` is missing (fallback stays crisis-aware); uvicorn `reload=True` is now guarded behind `DEBUG` so production never runs the file-watcher supervisor.

### Errors and logging

- [x] **Central error handling, no message leaks.** Controllers wrap handlers in `asyncHandler` and failures flow to one `errorHandler`; the inline `res.json({ error: error.message })` responses that leaked raw internals (Mongo parse errors, axios messages) are gone, and the error handler can no longer be bypassed.
- [x] **Consistent envelopes.** Validation failures return `{ error: { code, message, details } }` with proper 400s; unexpected errors return a generic 500 while the detail goes to the log.
- [x] **Log hygiene.** User, session and message ids are pseudonymized with a per-process salt in both the Winston meta and Morgan URL logging; the Python service pseudonymizes ids too, and no message content is written to logs.

### Frontend

- [x] **No hardcoded backend origin.** `VITE_API_BASE_URL` plus the Vite dev/preview proxy replace the hardcoded `http://localhost:5000` in chat, settings and action calls.
- [x] **One API path.** `utils/apiClient.js` handles JSON, errors and a single token re-mint on 401; `utils/session.js` performs the anonymous bootstrap. The browser-generated `user_${Date.now()}` identity module and the mock chat engine were deleted.
- [x] **Linting exists.** ESLint config + `lint` script added for the frontend (it previously had none), including React and React Hooks rules.
- [x] **Pages rewritten** against token-scoped endpoints (Chat with crisis panel and action buttons, Settings with consent + export/delete), with loading/error states and shared phase helpers.

### Tests, scripts and CI

- [x] **Backend suite (71 tests).** Token sign/verify/expiry, trust math and phase bands, crisis detection tiers, request validation, AI-response normalization, and HTTP-level contracts (401 without a token, 403 cross-user, 409 foreign session, CORS allow-list, error envelopes) — runs without MongoDB.
- [x] **AI service suite (60 tests).** Crisis-detection parity with the backend (shared cases), contract validation, structured-output parsing, config aliases, and ASGI-level CORS/auth/health checks; `ruff` configured via `ruff.toml`.
- [x] **CI rewritten.** Node 24, lint + tests for all three services, a MongoDB service container, background service startup, and live smoke/E2E steps; the repository secrets are actually read now.
- [x] **Live scripts rewritten** for the auth flow: `scripts/smokeChat.js` (session → chat → crisis escalation → cleanup) and `scripts/e2eChatFlow.js` (full loop plus explicit IDOR and session-hijack regressions).

### Data hygiene

- [x] `GET /api/preferences` is read-only — a GET no longer creates user records, so read traffic (including scanners) cannot populate the database.

---

## Remaining operational items

- [ ] **Rotate the MongoDB Atlas password** stored in `backend/.env` and move the URI into a secret manager. The file is not git-tracked, but it is a live cluster credential sitting in a synced folder — this cannot be fixed in code.
- [ ] **Before deploying:** set a strong `AUTH_SECRET` (32+ chars), real `CORS_ORIGINS` allow-lists, and matching internal API keys (see README → *Before You Deploy*).
- [ ] **Consider password-based (or federated) auth** if the product needs accounts that persist across devices/browsers. The current model is deliberately anonymous and token-based; that is a privacy choice, not an omission.
- [ ] **Shared rate-limit store** (Redis) if the backend ever runs as multiple replicas — the current limiter is per-process in-memory.
- [ ] **Confirm the Atlas `.env` is not synced off-machine** (OneDrive) before handing the repo to anyone else.

---

## Phase 1: Frontend Foundation

- [x] Build basic chat interface (HTML/CSS/JS)
- [x] Add trust score panel and phase labels
- [x] Add simple bot response loop (validation + reconnection + tiny step)
- [x] Move frontend to React app structure
- [x] Create reusable UI components (ChatWindow, MessageBubble, TrustCard, ChatInput)
- [x] Add route structure (Landing, Chat, Profile/Settings)
- [x] Add loading, error, and empty states

## Phase 2: Node/Express Backend (MERN)

- [x] Initialize backend folder and Express server
- [x] Add environment configuration and basic middleware
- [x] Create API endpoints:
  - [x] POST /api/auth/session (anonymous session minting)
  - [x] POST /api/chat
  - [x] POST /api/action-update
  - [x] GET /api/trust-score (token-scoped)
- [x] Add request validation and consistent error responses
- [x] Add API logging for debugging (with pseudonymized identifiers)
- [x] Add authentication middleware (`requireAuth` / `requireOwnership`) and rate limiting

## Phase 3: Python AI Service

- [x] Initialize FastAPI service
- [x] Create endpoint:
  - [x] POST /generate-response
- [x] Structured, human-sounding replies with a strict JSON contract
  - Model returns JSON (`response_format`) matching `JSON_OUTPUT_CONTRACT` in `prompts.py`: `content`, `emotional_validation`, `reconnection_nudge`, `tiny_action`, `followup_question`, `risk_flags`, `trust_phase`
  - Contract enforced with Pydantic (`schemas.py`) on the service side and normalized in `backend/services/aiService.js`
  - Free-text heuristics remain only as a degradation path when the model returns unstructured output
- [x] Add prompt templates for trust phases (listening / momentum / accountability) tuned for human tone and safety
- [x] Add crisis detection before the model call, plus a crisis-aware fallback when the model/API fails
- [x] Use Groq as the single LLM provider (`GROQ_API_KEY` required). OpenAI support removed to simplify configuration.

## How replies and trust scoring work now (supersedes the earlier "Recent implementations" notes)

- **Replies are structured JSON, not free text.** The earlier plan (plain-text reply plus first-sentence/last-question heuristics parsed out of it) was replaced because the backend re-parsed the Python service's output and the two sides fought over the fields. The model now returns the documented JSON contract; heuristics exist only as a fallback if the model ignores the format.
- **Temperature is 0.85 by default** (creative but grounded), configurable via `ai_service/.env`.
- **Trust deltas** (all computed and clamped server-side in `config/constants.js` / `utils/trustScore.js`, logged to `TrustHistory` with a reason):
  - `+3` for a supportive chat turn (bounded, cannot reach an extreme on its own)
  - `+2` extra when the reply proposes a tiny action
  - `+4` when the user confirms an action was completed (real user signal)
  - `-1` when the user declines
  - `-10` when crisis/risk flags are present — crisis never increases trust
  - score always clamped to [0, 100]
- **Safety:** crisis detection runs in the backend before the AI call and in the fallback path, plus once more in the AI service; escalations still instruct the user to seek immediate help and surface the crisis resources panel in the UI.

## Initial future plans (what you were planning for)

These were part of the original roadmap. Completed items are checked; the rest remain recommended next steps:

- [ ] Add a lightweight "convincingness" scorer (LLM-based or small classifier) to rate replies and refine trust deltas (would also retire the reply-shape `+3/+2` deltas)
- [ ] Collect explicit user feedback after suggested tiny actions to adjust trust (did user do the action? did it help?)
- [x] Add proactive engagement features: inactivity detection, scheduled nudges, and opt-outs *(consent toggle shipped; scheduler still open — see Phase 7)*
- [x] Add unit/integration tests for trust logic, prompt outputs, and backend normalization flow
- [x] Add CI to run linting and basic smoke tests on each push
- [ ] Consider a stable release checklist and pilot deployment (monitor trust trends, safety incidents)

## Immediate Next 5 Tasks (updated)

- [ ] Add convincingness scoring prototype (LLM or heuristic) and integrate into trust calculations
- [ ] Add user feedback capture for tiny actions and use feedback to adjust trust score
- [x] Add automated smoke tests for ai_service `/generate-response` and backend `/api/chat`
- [x] Add documentation for Groq account setup and required API settings
- [x] Add CI workflow for lint + smoke tests

## Phase 4: MongoDB Data Layer

- [x] Create MongoDB connection setup
- [x] Define models:
  - [x] User
  - [x] Session
  - [x] Message
  - [x] ActionCommitment
  - [x] TrustHistory
- [x] Persist chat sessions and trust score changes
- [x] Add indexes for userId + createdAt queries

## Phase 5: Integration

- [x] Connect React frontend to Express APIs
- [x] Connect Express backend to Python AI service
- [x] Map Python structured output into frontend chat messages
- [x] Persist each interaction in MongoDB
- [x] Add end-to-end test flow for one full chat loop

## Phase 6: Safety and Ethics

- [x] Add clear disclaimer (not therapist, not emergency support)
- [x] Add crisis keyword detection and escalation message
- [x] Make crisis handling independent of the model and AI service (backend pre-check + fallback branch + AI-service parity)
- [x] Add consent controls for proactive nudges
- [x] Add data privacy controls (export/delete data), scoped to the authenticated user
- [x] Add anti-dependency language guardrails in prompts

## Phase 7: Proactive Engagement

- [ ] Add inactivity detection logic
- [ ] Add scheduler for reminder nudges
- [ ] Track nudge sent vs response rate
- [x] Add opt-out controls for reminders (consent stored via `PUT /api/preferences`)

## Phase 8: Quality and Launch Readiness

- [x] Add unit tests for trust score logic
- [x] Add integration tests for API contracts
- [x] Add lint/format scripts for frontend, backend, and python service
- [x] Add CI workflow for test + lint checks
- [x] Improve README with setup steps for all services
- [ ] Prepare pilot release checklist

## Immediate Next 5 Tasks

- [ ] Add inactivity detection logic for proactive engagement
- [ ] Add scheduler for reminder nudges
- [ ] Track nudge sent vs response rate
- [x] Add opt-out controls for reminders
- [x] Add API integration tests for contracts
