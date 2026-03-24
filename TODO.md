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
  - [x] GET /api/trust-score
- [x] Add request validation and consistent error responses
- [x] Add API logging for debugging

## Phase 3: Python AI Service

- [ ] Initialize FastAPI service
- [ ] Create endpoint:
  - [ ] POST /generate-response
- [ ] Add structured response format:
  - [ ] emotional_validation
  - [ ] reconnection_nudge
  - [ ] tiny_action
  - [ ] followup_question
  - [ ] risk_flags
- [ ] Add prompt templates for trust phases
- [ ] Add basic fallback when model/API fails

## Phase 4: MongoDB Data Layer

- [ ] Create MongoDB connection setup
- [ ] Define models:
  - [ ] User
  - [ ] Session
  - [ ] Message
  - [ ] ActionCommitment
  - [ ] TrustHistory
- [ ] Persist chat sessions and trust score changes
- [ ] Add indexes for userId + createdAt queries

## Phase 5: Integration

- [ ] Connect React frontend to Express APIs
- [ ] Connect Express backend to Python AI service
- [ ] Map Python structured output into frontend chat messages
- [ ] Persist each interaction in MongoDB
- [ ] Add end-to-end test flow for one full chat loop

## Phase 6: Safety and Ethics

- [ ] Add clear disclaimer (not therapist, not emergency support)
- [ ] Add crisis keyword detection and escalation message
- [ ] Add consent controls for proactive nudges
- [ ] Add data privacy controls (export/delete data)
- [ ] Add anti-dependency language guardrails in prompts

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

- [x] Convert current frontend into a React app
- [ ] Set up Express server with /api/chat endpoint
- [ ] Set up FastAPI /generate-response endpoint
- [ ] Connect Express -> FastAPI call
- [ ] Store one chat session in MongoDB
