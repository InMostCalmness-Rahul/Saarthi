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
- [x] Add structured response format:
  - [x] emotional_validation
  - [x] reconnection_nudge
  - [x] tiny_action
  - [x] followup_question
  - [x] risk_flags
- [x] Add prompt templates for trust phases
- [x] Add basic fallback when model/API fails
- [x] Add OpenAI-compatible provider support (Groq/OpenAI via config)

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
- [ ] Improve README with setup steps for all services
- [ ] Prepare pilot release checklist

## Immediate Next 5 Tasks

- [ ] Add inactivity detection logic for proactive engagement
- [ ] Add scheduler for reminder nudges
- [ ] Track nudge sent vs response rate
- [ ] Add opt-out controls for reminders
- [ ] Add API integration tests for contracts
