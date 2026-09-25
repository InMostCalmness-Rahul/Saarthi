# Saarthi - An AI Companion for Support and Growth

Saarthi is an empathetic AI companion that helps people during difficult times by combining emotional validation with small, achievable actions. Instead of big advice, Saarthi listens first, validates your feelings, and suggests one tiny step forward - reconnecting you with people who matter and building momentum through consistent progress.

> Safety note: Saarthi is not a therapist and not an emergency service. In immediate danger, contact local emergency services. Crisis detection runs in the backend **before** the language model is called, so a crisis message is escalated even if the AI service is unreachable.

## How It Works

1. **You share what's on your mind** - feelings, challenges, or what is weighing on you
2. **Saarthi listens and validates** - your emotions are acknowledged
3. **A small action is suggested** - a concrete 5-15 minute step you can take today
4. **Progress is tracked** - your trust score reflects your journey through three phases:
   - **Listening** (0-39): building understanding and safety
   - **Momentum** (40-69): taking small actions forward
   - **Accountability** (70+): sustaining progress through connections

## Security and Privacy Model

This section describes the guarantees the code actually provides.

- **Server-minted identity.** The browser never chooses its own user id. `POST /api/auth/session` creates a random `user_<uuid>` and returns a signed token (HMAC-SHA256, `AUTH_SECRET`). Identity is read only from that token.
- **Every user-scoped request is authenticated.** Endpoints take identity from the `Authorization: Bearer <token>` header. Legacy `/resource/:userId` URLs still exist but the path parameter must equal the authenticated user, otherwise the request is rejected with `403`.
- **Trust scores are server-authoritative.** Clients report *what happened* (for example `completed: true` for a suggested action); the server owns the deltas and the clamping. A client-supplied `trustScoreDelta` is rejected with `400`.
- **Sessions cannot be hijacked.** A session id belonging to another user is refused with `409` instead of being silently re-pointed at the caller.
- **Crisis handling is model-independent.** `backend/utils/crisisDetection.js` runs first, and the AI-outage fallback path has its own crisis branch. Risk flags are returned to the UI, which shows a crisis resources panel.
- **Structured model output.** The AI service asks Groq for JSON (`response_format`) and validates it with Pydantic, so fields are no longer guessed out of free text. Heuristics remain only as a degradation path for unstructured replies.
- **No wildcard CORS.** Both services use explicit origin allow-lists and never combine `*` with credentials.
- **Log hygiene.** User/session ids are pseudonymized with a per-process salt before they are logged, and connection strings / API keys are redacted. `GET /api/preferences` no longer creates records as a side effect of being read.
- **Security headers and rate limits.** The backend uses `helmet`; session minting and chat/write endpoints are rate limited per client IP.

Additional operational notes:

- Set a real `AUTH_SECRET` (32+ characters) before deploying. In production the backend refuses to start without it; in development an ephemeral secret is generated and a warning is logged.
- Rotate any database credential that has ever been stored in plaintext on disk, and keep secrets in a managed secret store rather than a synced folder.
- `INTERNAL_API_KEY` (ai_service) / `AI_SERVICE_API_KEY` (backend) can be set to require a shared secret on the backend -> AI-service hop.

## Quick Start

Saarthi consists of three services working together.

### Prerequisites

- **Node.js 22+** (Node 24 recommended; the backend test script uses the test runner's glob support)
- **Python 3.10+**
- **MongoDB** (local or cloud URI)
- **LLM API key** (Groq)

### Step 1: Start the Backend (Express API)

```bash
cd backend
npm install
npm run dev
```

Backend runs at **http://localhost:5000**.

Create or update `backend/.env`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/saarthi
AI_SERVICE_URL=http://127.0.0.1:8000
AUTH_SECRET=replace-with-a-random-32-plus-character-string
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
LOG_LEVEL=info
```

Generate a signing key with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

See `backend/.env.example` for every supported variable (timeouts, rate limits, optional internal API key, JSON body limit, proxy hops).

### Step 2: Start the AI Service (Python FastAPI)

```bash
cd ai_service
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements-dev.txt   # runtime + pytest/ruff/httpx
cp .env.example .env
```

Edit `.env`:

```env
GROQ_API_KEY=gsk_your_groq_key
API_BASE_URL=https://api.groq.com/openai/v1
MODEL=openai/gpt-oss-20b
TEMPERATURE=0.85
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
DEBUG=false
```

Notes:

- Groq is the single supported provider. Remove any OpenAI keys from `ai_service/.env`.
- Without `GROQ_API_KEY` the service logs a startup warning and answers from its crisis-aware fallback path.
- `DEBUG=true` enables the uvicorn auto-reloader. Keep it `false` outside development: the reloader spawns a file watcher and a supervisor process.
- The `GROQ_API_BASE_URL` / `GROQ_MODEL` / `GROQ_TEMPERATURE` aliases are also accepted, so the GitHub Actions secrets can be reused as-is.

Start the service:

```bash
python main.py
```

AI service runs at **http://127.0.0.1:8000**.

**CI note:** to let CI call Groq for real, add the repository secret `GROQ_API_KEY` (and optionally `GROQ_API_BASE_URL`, `GROQ_MODEL`, `GROQ_TEMPERATURE`) at `Settings -> Secrets and variables -> Actions`. CI also sets a non-secret `AUTH_SECRET` and internal API key for the smoke tests.

### Step 3: Start the Frontend (React UI)

```bash
cd frontend
npm install
npm run dev
```

Frontend opens at **http://localhost:5173**.

No configuration is required for local development: the app calls the backend on relative URLs and Vite proxies `/api` to `http://127.0.0.1:5000`. For a deployed build set `VITE_API_BASE_URL` (see `frontend/.env.example`).

### Step 4: Test the Chat

1. Open http://localhost:5173
2. Type a message such as "I'm feeling overwhelmed with work"
3. Press Enter or click Send
4. Saarthi replies with validation, an optional tiny action, and a follow-up question

When a message is flagged as a crisis, the request is answered by the backend safety path and the chat shows a crisis resources panel with helplines.

## Architecture

```
┌──────────────────────────────────────────────┐
│  Browser (http://localhost:5173)             │
│  React frontend - holds only a signed token  │
└───────────────────┬──────────────────────────┘
                    │ /api (Bearer token)
                    ↓
┌──────────────────────────────────────────────┐
│  http://localhost:5000                       │
│  Express backend                             │
│  auth • validation • crisis pre-check •      │
│  trust arithmetic • privacy export/delete    │
└───────┬───────────────────────────┬──────────┘
        │ POST /generate-response   │ persistence
        │ (JSON contract)           ↓
        ↓                     ┌──────────────────┐
┌───────────────────────────┐ │     MongoDB      │
│ http://127.0.0.1:8000     │ │ users, sessions, │
│ Python FastAPI AI service │ │ messages, trust  │
│ Groq + prompt phases      │ └──────────────────┘
└───────────────────────────┘
```

Two independent safety layers exist in this flow: the backend detects crisis language before it calls the AI service, and the AI service checks again before it calls the model.

## What's in Each Service

### Frontend (React + Vite)
- Chat interface, trust phase panel, Landing/Chat/Settings pages
- Anonymous session bootstrap (`utils/session.js`) with a single API client (`utils/apiClient.js`)
- Crisis resources panel driven by the `risk_flags` returned from the backend
- Tiny-action confirmation buttons ("I did it" / "Not now") that post to the trusted action endpoint
- Consent toggle plus data export/delete controls

### Backend (Express.js)
- Session minting and signed-token verification (`middleware/auth.js`, `utils/token.js`)
- Request validation, consistent error envelopes, security headers, rate limiting
- Server-side crisis detection (`utils/crisisDetection.js`) and server-owned trust scoring (`utils/trustScore.js`, `services/trustService.js`)
- AI integration boundary with normalization (`services/aiService.js`) and session ownership rules (`services/sessionService.js`)
- Privacy controls: full export and hard delete for the authenticated user

### AI Service (Python + FastAPI)
- Groq integration with a strict JSON output contract (`schemas.py`)
- Trust-phase prompt templates (`prompts.py`)
- Crisis detection before the model call, plus a crisis-aware fallback
- Pseudonymized logging and an optional internal API key

## API Reference

### Authentication

| Method | Endpoint | Notes |
| --- | --- | --- |
| `POST` | `/api/auth/session` | Mints `{ userId, token, expiresAt, trustScore, trustPhase }` for an anonymous user. Rate limited. |
| `GET` | `/api/auth/me` | Validates the token and returns the caller's identity and trust state. |

Send the token on every user-scoped call: `Authorization: Bearer <token>`.

### User-scoped endpoints (frontend -> backend)

| Method | Endpoint | Notes |
| --- | --- | --- |
| `POST` | `/api/chat` | Body: `{ message, sessionId? }`. Identity comes from the token; a `userId` in the body must match it. |
| `POST` | `/api/action-update` | Body: `{ actionCommitment, completed, sessionId? }`. Server derives the delta (+4 completed / -1 not now). `trustScoreDelta` is rejected. |
| `GET` | `/api/trust-score` | Current score and phase. |
| `GET` | `/api/preferences` | Read-only; returns defaults when the user has no record yet. |
| `PUT` | `/api/preferences` | Body: `{ proactiveNudgesConsent: boolean }`. |
| `GET` | `/api/user-data/export` | Full JSON export for the authenticated user. |
| `DELETE` | `/api/user-data` | Hard delete of all data for the authenticated user. |

Legacy user-scoped URLs (`/api/trust-score/:userId`, `/api/preferences/:userId`, `/api/user-data/:userId/export`, `DELETE /api/user-data/:userId`) remain available but only accept the authenticated user's own id; anything else returns `403`.

### Backend -> AI service

| Method | Endpoint | Notes |
| --- | --- | --- |
| `POST` | `/generate-response` | Body: `{ message, trust_phase, user_id? }`. Response is validated against the documented JSON contract. |
| `GET` | `/health` | Liveness plus the configured model name. |

### Response contract (AI service -> backend)

```json
{
  "success": true,
  "data": {
    "content": "full natural-language reply",
    "emotional_validation": "one short sentence or null",
    "reconnection_nudge": "optional or null",
    "tiny_action": "optional 5-15 minute step or null",
    "followup_question": "optional single question or null",
    "risk_flags": ["CRISIS_DETECTED", "FALLBACK_ACTIVE"],
    "trust_phase": "listening"
  }
}
```

Every chat response also includes `sessionId`, `sessionLength`, `trustScore`, `trustPhase` and `fallbackUsed`.

## Testing and Quality Checks

| Scope | Command | What it covers |
| --- | --- | --- |
| Backend unit + HTTP contract | `cd backend && npm test` | Token signing/verification, trust arithmetic, crisis detection, validation middleware, AI-response normalization, and HTTP-level auth/IDOR/CORS/error-envelope behaviour (no database required) |
| Backend lint | `cd backend && npm run lint` | ESLint (`eslint:recommended` + project rules) |
| Backend smoke (live) | `cd backend && npm run test:smoke-chat` | Anonymous access rejected, session minting, chat turn, crisis escalation, cleanup |
| Backend E2E (live) | `cd backend && npm run test:e2e-chat` | Full flow plus explicit IDOR and session-hijack regression checks |
| AI service tests | `cd ai_service && python -m pytest` | Crisis detection parity, response contract, structured-output parsing, config aliases, ASGI contract/CORS/auth |
| AI service lint | `cd ai_service && python -m ruff check .` | Pyflakes + pycodestyle correctness rules |
| AI service smoke (live) | `cd ai_service && python smoke_generate_response.py` | Health, contract fields, crisis flagging, validation errors |
| Frontend lint | `cd frontend && npm run lint` | ESLint with React and React Hooks rules |
| Frontend build | `cd frontend && npm run build` | Production bundle |

The backend test suite is deliberately database-free for its contract tests, so `npm test` works on a clean checkout. The live smoke and E2E scripts need MongoDB and the AI service running.

### Verification snapshot

- `npm test` (backend): 71 passed
- `python -m pytest` (AI service): 60 passed
- `ruff check`, `npm run lint` (backend + frontend), `npm run build`: clean
- Live AI-service smoke test: passed against Groq with structured JSON output

## Configuration Reference

### backend/.env

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | HTTP port |
| `NODE_ENV` | `development` | `production` enforces `AUTH_SECRET` and hides stack traces |
| `MONGODB_URI` | - | Required; connection string |
| `AI_SERVICE_URL` | `http://127.0.0.1:8000` | AI service base URL |
| `AI_SERVICE_TIMEOUT_MS` | `10000` | Per-request timeout for the AI service |
| `AI_SERVICE_API_KEY` | empty | Sent as `X-Internal-Api-Key` when set |
| `AUTH_SECRET` | ephemeral in dev | Signs session tokens; 32+ characters, required in production |
| `AUTH_TOKEN_TTL_DAYS` | `30` | Session token lifetime |
| `CORS_ORIGINS` | localhost dev origins | Comma-separated allow-list (no wildcards) |
| `JSON_BODY_LIMIT` | `32kb` | Request body size cap |
| `LOG_LEVEL` | `info` | `error` \| `warn` \| `info` \| `debug` |
| `LOG_SALT` | random per process | Salt used to pseudonymize ids in logs |
| `AUTH_RATE_LIMIT_MAX` | `30` | Session minting requests per minute per IP |
| `CHAT_RATE_LIMIT_MAX` | `60` | Chat requests per minute per IP |
| `WRITE_RATE_LIMIT_MAX` | `30` | Preference/action/delete requests per minute per IP |
| `RATE_LIMIT_DISABLED` | empty | `1` disables rate limiting (used by tests) |
| `TRUST_PROXY_HOPS` | `0` | Trusted proxy hops; keep `0` unless behind a proxy |

### ai_service/.env

| Variable | Default | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | empty | Required for live model calls |
| `API_BASE_URL` / `GROQ_API_BASE_URL` | `https://api.groq.com/openai/v1` | Provider endpoint |
| `MODEL` / `GROQ_MODEL` | `openai/gpt-oss-20b` | Model name |
| `TEMPERATURE` / `GROQ_TEMPERATURE` | `0.85` | Sampling temperature (0.0-2.0) |
| `MAX_TOKENS` | `300` | Reply length cap |
| `REQUEST_TIMEOUT_SECONDS` | `15` | Upstream request timeout |
| `HOST` / `PORT` | `127.0.0.1` / `8000` | Bind address |
| `DEBUG` | `false` | Enables the uvicorn auto-reloader |
| `CORS_ORIGINS` | localhost dev origins | Comma-separated allow-list |
| `INTERNAL_API_KEY` | empty | When set, requires `X-Internal-Api-Key` on requests |
| `LOG_LEVEL` | `INFO` | Python log level |

## Troubleshooting

### "Connection refused" when sending a message?
- Make sure all three services and MongoDB are running
- Check that the backend (5000) and AI service (8000) are reachable
- Look for errors in the respective terminal windows

### Getting `401` from the API?
- The browser session token is missing or expired. Clear `saarthi_session` in local storage; the app mints a new anonymous session on the next load.
- Every user-scoped call needs `Authorization: Bearer <token>`.

### Getting `403 You are not allowed to access another user's data`?
- A legacy `/:userId` URL or a body `userId` was used for a different user. Use the token-scoped endpoint (`/api/trust-score`, `/api/user-data/export`, ...) instead.

### Getting `409 This session does not belong to the authenticated user`?
- A `sessionId` created by a different identity was reused. Start a new session id or omit `sessionId`.

### "AUTH_SECRET must be set ... in production"
- The backend refuses to start in production without a 32+ character `AUTH_SECRET`. Generate one and restart. In development an ephemeral key is used and a warning is logged (sessions reset on restart).

### "Invalid API key" / "GROQ_API_KEY is not set"
- Confirm `ai_service/.env` contains a valid `gsk_` key, then restart the service
- Without a key the service still runs, but every reply comes from the fallback path

### Crisis message did not reach the model
- That is intentional. Crisis handling is performed by the backend safety path (and again in the AI service) so it cannot depend on the model or on the AI service being up.

### Chat showing an error message?
- Open DevTools (F12) and check the Console/Network tabs. API errors are now generic; detailed diagnostics live in the backend log, with identifiers pseudonymized.

### Port already in use?
- Frontend: change the port in `frontend/vite.config.js`
- Backend: change `PORT` in `backend/.env`
- AI service: change `PORT` in `ai_service/.env` and update `AI_SERVICE_URL`

### Backend starts but chat fails immediately?
- Ensure MongoDB is running and `MONGODB_URI` is valid in `backend/.env`

### `npm run lint` fails with "no configuration found"
- Configuration files are committed (`.eslintrc.json` in `backend/` and `frontend/`, `ruff.toml` in `ai_service/`). Re-run `npm install` if ESLint is missing.

### Windows console shows garbled characters in the AI service output
- That is console encoding, not stored data. Set UTF-8 with `chcp 65001` if it bothers you.

## Before You Deploy

1. **Rotate any credential that has been stored in plaintext on disk** and move it to a secret manager. A MongoDB Atlas connection string sitting in a synced folder is a live credential; rotate the database password even if the file was never committed.
2. Set a strong `AUTH_SECRET` and a real `CORS_ORIGINS` allow-list for both services.
3. Set `AI_SERVICE_API_KEY` (backend) and `INTERNAL_API_KEY` (AI service) to the same value so the internal hop is authenticated.
4. Keep `DEBUG=false` and `NODE_ENV=production`.
5. Terminate TLS in front of the services, set `TRUST_PROXY_HOPS` to match your ingress, and keep `NODE_ENV=production` so stack traces are never returned.
6. Review log retention: identifiers are pseudonymized and message content is not logged at all - keep it that way.

## File Structure

```
Saarthi/
├── frontend/                    # React UI
│   ├── src/
│   │   ├── components/          # ChatWindow, MessageBubble, TrustCard, ChatInput
│   │   ├── data/seedMessages.js # Conversation starter
│   │   ├── pages/               # Landing, Chat, Settings
│   │   └── utils/
│   │       ├── apiClient.js     # Single fetch wrapper + ApiError
│   │       ├── session.js       # Session bootstrap / token storage
│   │       └── trustPhase.js    # Phase thresholds shared with the backend
│   ├── .eslintrc.json
│   └── vite.config.js           # Dev/preview proxy to the backend
├── backend/                     # Express API
│   ├── app.js                   # App factory (helmet, CORS, logging, routes)
│   ├── server.js                # Bootstrap + graceful shutdown
│   ├── config/
│   │   ├── constants.js         # Trust deltas, phases, limits, id patterns
│   │   ├── db.js
│   │   └── env.js               # Env access with fail-fast validation
│   ├── controllers/             # authController, chatController
│   ├── middleware/              # auth (tokens, ownership, rate limits), validation, errorHandler
│   ├── models/                  # User, Session, Message, ActionCommitment, TrustHistory
│   ├── routes/                  # authRoutes, chatRoutes
│   ├── services/                # aiService, sessionService, trustService, userService
│   ├── utils/                   # token, crisisDetection, trustScore, logger, http
│   ├── scripts/                 # smokeChat, e2eChatFlow
│   ├── tests/                   # node:test suites
│   └── .eslintrc.json
├── ai_service/                  # Python FastAPI
│   ├── main.py                  # FastAPI app (CORS, internal key, reload guard)
│   ├── ai_engine.py             # Groq call, JSON parsing, crisis detection
│   ├── config.py                # Settings incl. GROQ_* aliases
│   ├── prompts.py               # Phase prompts + JSON output contract
│   ├── schemas.py               # Pydantic response contract
│   ├── tests/                   # pytest suites
│   ├── pytest.ini
│   └── ruff.toml
├── .github/workflows/ci.yml     # Lint, tests, smoke tests, E2E
└── README.md
```

## Contributing

1. **Report Issues**: found a bug or have an idea? Open an issue with clear details.
2. **Submit Code**:
   - Fork the repository and create a feature branch: `git checkout -b feature/your-feature-name`
   - Make your changes and run the checks listed under *Testing and Quality Checks*
   - Commit with clear messages and open a pull request
3. **Code Style**:
   - Frontend: small components, hooks-correct, no client-side trust math
   - Backend: keep controllers thin, put domain rules in `utils/` or `services/`, validate every input
   - Python: PEP 8, type hints where practical, keep the response contract in `schemas.py` authoritative
4. **Invariants to preserve**:
   - Identity comes only from a signed token, never from client input
   - Trust deltas are computed server-side
   - Crisis handling must never depend on the model being available
   - The AI response contract stays validated by Pydantic on the service side

## License

This project is licensed under the MIT License. See the LICENSE file for details.
