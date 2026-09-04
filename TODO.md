# Saarthi TODO

This checklist is organized so you can build from prototype to MERN + Python AI MVP.

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
  - [x] POST /api/chat
  - [x] POST /api/action-update
  - [x] GET /api/trust-score/:userId
- [x] Add request validation and consistent error responses
- [x] Add API logging for debugging

## Phase 3: Python AI Service

- [x] Initialize FastAPI service
- [x] Create endpoint:
  - [x] POST /generate-response
- [x] Use natural conversational responses (no rigid JSON requirement)
  - Model is instructed to reply like a human (1-4 short paragraphs) with optional tiny action or reconnection nudge when appropriate
  - Backend normalizes model output into simple fields (content, emotional_validation, followup_question, tiny_action if present)
- [x] Add prompt templates for trust phases (listening / momentum / accountability) tuned for human tone and safety
- [x] Add basic fallback when model/API fails
- [x] Use Groq as the single LLM provider (GROQ_API_KEY required). OpenAI support removed to simplify configuration.


## Recent implementations (what was just implemented)

- Natural replies: The AI prompts and ai_engine were changed so the model returns natural, plain-text replies instead of requiring structured JSON. The ai_engine now extracts lightweight heuristics:
  - content: full model reply (displayed to user)
  - emotional_validation: first sentence / first line
  - followup_question: last question sentence (if present)
  - tiny_action / reconnection_nudge: included when model explicitly provides one (otherwise null)
  - risk_flags: preserved for crisis detection

- Temperature and creativity: ai_service default temperature increased to 0.85 to encourage more human-like, creative replies. This is configurable via ai_service/.env.

- Backend normalization: backend/chatController now accepts either a plain string or an object from the AI service and normalizes it into stored message fields. This prevents brittle JSON parsing errors and supports human-style chat.

- Trust scoring heuristic: a simple, explainable heuristic was added and persisted to TrustHistory:
  - baseline +3 for a supportive reply
  - +2 additional if model suggests a tiny_action
  - -10 penalty if crisis/risk flags detected
  - trustScore bounded to [0,100]

- Safety: crisis keywords and escalation remain in place and apply stronger negative trust delta; crisis replies still provide instructions to seek immediate help.


## Initial future plans (what you were planning for)

These were part of the original roadmap and remain recommended next steps:

- Add a lightweight "convincingness" scorer (LLM-based or small classifier) to rate replies and refine trust deltas.
- Collect explicit user feedback after suggested tiny actions to adjust trust (did user do the action? did it help?).
- Add proactive engagement features: inactivity detection, scheduled nudges, and opt-outs.
- Add unit/integration tests for trust logic, prompt outputs, and backend normalization flow.
- Add CI to run linting and basic smoke tests on each push.
- Consider a stable release checklist and pilot deployment (monitor trust trends, safety incidents).


## Immediate Next 5 Tasks (updated)

- [ ] Add convincingness scoring prototype (LLM or heuristic) and integrate into trust calculations
- [ ] Add user feedback capture for tiny actions and use feedback to adjust trust score
- [ ] Add automated smoke tests for ai_service /generate-response and backend /api/chat
- [ ] Add documentation for Groq account setup and required API settings
- [ ] Add CI workflow for lint + smoke tests

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
- [x] Add consent controls for proactive nudges
- [x] Add data privacy controls (export/delete data)
- [x] Add anti-dependency language guardrails in prompts

## Phase 7: Proactive Engagement

- [ ] Add inactivity detection logic
- [ ] Add scheduler for reminder nudges
- [ ] Track nudge sent vs response rate
- [ ] Add opt-out controls for reminders

## Phase 8: Quality and Launch Readiness

- [ ] Add unit tests for trust score logic
- [ ] Add integration tests for API contracts
- [ ] Add lint/format scripts for frontend, backend, and python service
- [ ] Add CI workflow for test + lint checks
- [x] Improve README with setup steps for all services
- [ ] Prepare pilot release checklist

## Immediate Next 5 Tasks

- [ ] Add inactivity detection logic for proactive engagement
- [ ] Add scheduler for reminder nudges
- [ ] Track nudge sent vs response rate
- [ ] Add opt-out controls for reminders
- [ ] Add API integration tests for contracts
