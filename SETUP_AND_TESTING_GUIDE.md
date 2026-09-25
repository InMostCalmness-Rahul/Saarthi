# Saarthi - Complete Setup & Testing Guide

## Prerequisites

Ensure you have the following installed:

- **Node.js 22+** (Node 24 recommended) - https://nodejs.org/
- **Python 3.10+** - https://www.python.org/
- **npm** (comes with Node.js) and **pip**
- **MongoDB** (local instance or cloud URI)
- An **LLM API Key** (Groq - required for live replies)

> This guide is written for Windows paths. On macOS/Linux, drop the `c:\Users\...` prefixes.

---

## Step 1: Configure Your LLM API Key

**Before you start:** you MUST add a valid Groq API key to the AI service.

1. Open `ai_service/.env` (copy `ai_service/.env.example` if it does not exist)
2. Add the following values (example):

   ```env
   GROQ_API_KEY=gsk_your_groq_key
   API_BASE_URL=https://api.groq.com/openai/v1
   MODEL=openai/gpt-oss-20b
   TEMPERATURE=0.85
   CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
   DEBUG=false
   ```

3. Save the file.

**CI note:** to let GitHub Actions call Groq for real responses, add repository secrets `GROQ_API_KEY` (and optionally `GROQ_API_BASE_URL`, `GROQ_MODEL`, `GROQ_TEMPERATURE`) at *Settings > Secrets and variables > Actions*. The `GROQ_`-prefixed names are read first by `config.py`, so the CI names work locally too.

Without this step the AI service still starts, logs a warning, and returns crisis-aware fallback responses.

**Keep `DEBUG=false`** unless you want the uvicorn auto-reloader (extra watcher/supervisor processes).

---

## Step 2: Configure the Backend Environment

Open a terminal and run:

```bash
cd "c:\Users\rahul\OneDrive\Desktop\Project1\Saarthi\backend"
npm install
```

This installs Express, axios, helmet, express-rate-limit, jsonwebtoken, ESLint, and the other Node packages.

Make sure `backend/.env` includes a valid Mongo URI **and a signing secret**:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/saarthi
AI_SERVICE_URL=http://127.0.0.1:8000
AUTH_SECRET=replace-with-a-random-32-plus-character-string
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
LOG_LEVEL=info
```

Generate a value for `AUTH_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`AUTH_SECRET` signs the anonymous session tokens. In development an ephemeral key is generated (with a warning) if you skip it, but in `NODE_ENV=production` the backend refuses to start without one.

---

## Step 3: Install Frontend Dependencies

Open a **new terminal** and run:

```bash
cd "c:\Users\rahul\OneDrive\Desktop\Project1\Saarthi\frontend"
npm install
```

This installs React, React Router, Vite, ESLint and the React Hooks lint plugin.

No further configuration is needed locally: the app uses relative `/api` URLs and the Vite dev/preview proxies forward them to `http://127.0.0.1:5000`. For a deployed build set `VITE_API_BASE_URL` (see `frontend/.env.example`).

---

## Step 4: Install Python AI Service Dependencies

Open a **new terminal** and run:

```bash
cd "c:\Users\rahul\OneDrive\Desktop\Project1\Saarthi\ai_service"
pip install -r requirements-dev.txt
```

`requirements-dev.txt` installs the runtime packages (FastAPI, Pydantic, uvicorn, httpx, python-dotenv) plus the dev tools (`pytest`, `pytest-asyncio`, `ruff`, `httpx`). Use `requirements.txt` instead if you only want runtime dependencies.

---

## Step 5: Run All Three Services

Open **three terminal windows** and run them simultaneously:

### Terminal 1 - Backend (Express API Server)

```bash
cd "c:\Users\rahul\OneDrive\Desktop\Project1\Saarthi\backend"
npm run dev
```

You should see: `Server running on port 5000`

### Terminal 2 - AI Service (Python FastAPI Server)

```bash
cd "c:\Users\rahul\OneDrive\Desktop\Project1\Saarthi\ai_service"
python main.py
```

You should see: `Uvicorn running on http://127.0.0.1:8000`

### Terminal 3 - Frontend (React Development Server)

```bash
cd "c:\Users\rahul\OneDrive\Desktop\Project1\Saarthi\frontend"
npm run dev
```

You should see: `Local: http://localhost:5173`

---

## Step 6: Test the Application

1. **Open your browser** to `http://localhost:5173`
2. On first load the app calls `POST /api/auth/session` and receives an anonymous `user_<uuid>` plus a signed token (stored in local storage under `saarthi_session`). You never pick a user id yourself.
3. **Click the Chat button** on the landing page
4. **Type a test message**, for example:
   - "I'm feeling really overwhelmed with work"
   - "I don't know if I can keep going" (crisis path - answered by the backend safety path and shows the crisis resources panel)
   - "I want to make a positive change"
5. **Press Enter** (or click Send) and watch the reply appear with validation, an optional tiny action, and a follow-up question
6. **Confirm the trust panel** moves with your session (server-owned score starting at 50, phase thresholds 0-39 listening / 40-69 momentum / 70+ accountability)
7. **Try the tiny action buttons** ("I did it" / "Not now") - the score changes by +4 / -1 computed by the server
8. **Open Settings**: toggle proactive nudge consent, then use *Export My Data* (returns a JSON file for your token's user only)

---

## Step 7: Run the Automated Test Suites

These run without a browser and the backend/AI suites do not need a live model call.

```bash
# Backend: 71 tests (tokens, trust math, crisis detection, validation, HTTP contract)
cd "c:\Users\rahul\OneDrive\Desktop\Project1\Saarthi\backend"
npm test
npm run lint

# AI service: 60 tests + lint
cd "c:\Users\rahul\OneDrive\Desktop\Project1\Saarthi\ai_service"
python -m pytest
python -m ruff check .

# Frontend: lint + production build
cd "c:\Users\rahul\OneDrive\Desktop\Project1\Saarthi\frontend"
npm run lint
npm run build
```

Expected results: all tests pass, lint output is empty, and Vite reports a successful build.

> The backend HTTP-contract tests boot the Express app in-process with `RATE_LIMIT_DISABLED=1` and do **not** require MongoDB, so `npm test` works on a clean checkout. The live scripts below do require MongoDB and the AI service.

---

## Step 8: Run the Live Smoke and End-to-End API Flow Tests

With backend + AI service running (and MongoDB up), run:

```bash
cd "c:\Users\rahul\OneDrive\Desktop\Project1\Saarthi\backend"

# Short live smoke: anonymous access rejected, session minting, one chat turn, cleanup
npm run test:smoke-chat

# Full E2E: chat loop + trust deltas + explicit IDOR and session-hijack regression checks
npm run test:e2e-chat
```

Expected result: `E2E flow passed successfully`.

You can also hit the AI service directly (it validates the response contract with Pydantic):

```bash
cd "c:\Users\rahul\OneDrive\Desktop\Project1\Saarthi\ai_service"
python smoke_generate_response.py
```

---

## How Data Flows Through the System

```
Frontend (React)
    ↓ (POST /api/auth/session on first load)
Backend mints user_<uuid> + signed token
    ↓ (Bearer token on every /api call)
Frontend sends message → POST /api/chat
    ↓ (identity read from token, not from the request body)
Backend validates input, checks crisis language FIRST
    ├─ crisis detected → backend safety reply + risk_flags (no model call needed)
    └─ otherwise → POST /generate-response to AI service
        ↓
    AI Service checks crisis again, then calls Groq with a JSON output contract
        ↓
    Structured reply validated by Pydantic → backend → frontend
        ↓
Backend updates MongoDB (session/messages/trust history) and returns trustScore/trustPhase
    ↓
User sees the empathetic response, trust panel and crisis panel (if flagged)
```

Crisis handling is duplicated on purpose: the backend escalates even when the AI service is down, and the AI service escalates even if a future code path skips the backend check.

---

## Troubleshooting

### **"Cannot connect to backend" error in browser console**
- Make sure Terminal 1 (backend) is running
- Check that you see `Server running on port 5000`
- If not, run `npm run dev` again with the correct path

### **`401` on API calls / chat stuck loading**
- The session token is missing or expired. Clear the `saarthi_session` item from local storage (DevTools > Application) and reload; the app mints a fresh anonymous session automatically
- The app re-mints a token once on a `401` and retries; repeated `401`s mean `AUTH_SECRET` changed after tokens were issued (restart fixes it)

### **`403 You are not allowed to access another user's data`**
- You passed a `userId` (in the URL or body) that does not match your token's user. Use the token-scoped endpoints (`/api/trust-score`, `/api/preferences`, `/api/user-data/export`) instead of the legacy `/:userId` forms - this is the IDOR protection working

### **`409 This session does not belong to the authenticated user`**
- A `sessionId` minted for a different identity was reused. Omit `sessionId` or let the app start a new session

### **"AUTH_SECRET must be set ... in production"**
- Set a 32+ character `AUTH_SECRET` in `backend/.env` (see Step 2) and restart. In development an ephemeral key is used instead, with a warning in the log

### **"Error calling AI service" in backend terminal**
- Make sure Terminal 2 (AI service) is running
- Check that you see `Uvicorn running on http://127.0.0.1:8000`
- Verify `GROQ_API_KEY` is set correctly in `ai_service/.env`
- If the AI service is down you still get a reply: the backend falls back to its own crisis-aware response (`fallbackUsed: true`)

### **"MongoDB connection failed" in backend terminal**
- Ensure MongoDB is running locally or the cloud URI is reachable
- Verify `MONGODB_URI` in `backend/.env`
- Restart the backend after env changes

### **"Invalid API key" error in AI service terminal**
- Go to `ai_service/.env` and confirm the Groq key is correct (Groq keys start with `gsk_`)
- Verify `API_BASE_URL` matches your provider
- Without a key the service runs in fallback mode, so live replies will never appear

### **Chat showing "Something went wrong"**
- Open DevTools (F12) > Network and read the status code (401/403/409/500 mean different things, see above)
- Detailed diagnostics are in the backend terminal; ids in those logs are pseudonymized, message content is not logged

### **Crisis message did not reach the model**
- Intentional. Crisis messages are answered by the backend safety path with `risk_flags` and the UI crisis resources panel; the model is not consulted

### **Need to verify consent/privacy controls quickly?**
- Go to the Settings page in the frontend
- Toggle proactive reminders consent
- Click *Export My Data* and check the downloaded JSON (only your token's user data)
- Click *Delete My Data* only if you want to permanently erase the test data

### **Chat doesn't send when pressing Enter**
- Try clicking the Send button as a backup
- Check the browser console (F12) for errors
- Confirm the backend is running and the session bootstrap succeeded (Network tab shows a `201` from `/api/auth/session`)

### **Lint failures ("no configuration found" / missing parser)**
- Re-run `npm install` in the folder; ESLint config files are committed (`.eslintrc.json` in `backend/` and `frontend/`, `ruff.toml` in `ai_service/`)

### **"UnicodeDecodeError" or encoding errors on Windows**
- Try running Python with: `python -u main.py`
- Or use `chcp 65001` first (to set the terminal to UTF-8)

### **Port already in use (Address already in use)**
- Port 5000: change `PORT` in `backend/.env`
- Port 8000: change `PORT` in `ai_service/.env` and update `AI_SERVICE_URL` in `backend/.env`
- Port 5173: change the port in `frontend/vite.config.js` (and remember `CORS_ORIGINS` on both services)

---

## File Structure Reference

```
Saarthi/
├── frontend/                   # React UI
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx  # Intro + disclaimer
│   │   │   ├── ChatPage.jsx     # Main chat interface + crisis panel
│   │   │   └── SettingsPage.jsx # Consent + export/delete
│   │   ├── components/          # ChatInput, ChatWindow, MessageBubble, TrustCard
│   │   └── utils/
│   │       ├── apiClient.js     # Single fetch wrapper (Bearer token, retries 401 once)
│   │       ├── session.js       # Anonymous session bootstrap
│   │       └── trustPhase.js    # Phase thresholds shared with the backend
│   ├── .eslintrc.json
│   └── vite.config.js           # Dev/preview proxy → http://127.0.0.1:5000
│
├── backend/                    # Express API
│   ├── app.js                   # App factory (helmet, CORS, logging, routes)
│   ├── server.js                # Bootstrap + graceful shutdown
│   ├── controllers/             # authController, chatController
│   ├── middleware/              # requireAuth, requireOwnership, validation, errorHandler, rate limits
│   ├── routes/                  # authRoutes, chatRoutes
│   ├── services/                # aiService, sessionService, trustService, userService
│   ├── utils/                   # token, crisisDetection, trustScore, logger, http
│   ├── tests/                   # node:test suites (71 tests)
│   ├── scripts/                 # smokeChat, e2eChatFlow
│   ├── .eslintrc.json
│   └── .env                     # AUTH_SECRET, MONGODB_URI, AI_SERVICE_URL, CORS_ORIGINS
│
├── ai_service/                 # Python FastAPI
│   ├── main.py                  # Receives requests from backend (CORS allow-list, internal key)
│   ├── ai_engine.py             # Calls Groq + parses the JSON contract
│   ├── config.py                # Settings incl. GROQ_* aliases
│   ├── prompts.py               # Phase prompts + JSON output contract
│   ├── schemas.py               # Pydantic response contract
│   ├── tests/                   # pytest suites (60 tests)
│   ├── ruff.toml / pytest.ini
│   └── .env                     # GROQ_API_KEY and provider settings
│
├── .github/workflows/ci.yml    # Lint + tests + smoke + E2E for all three services
├── README.md
└── SETUP_AND_TESTING_GUIDE.md  # This file
```

---

## Next Steps After Testing

Once you confirm the system works:

1. Customize AI prompts in `ai_service/prompts.py`
2. Review `TODO.md` - all reported defects are marked resolved there; remaining roadmap items are listed
3. Add proactive engagement scheduler (Phase 7)
4. Rotate any database credential stored in plaintext on disk, then deploy (see *Before You Deploy* in README.md)
5. Gather user feedback and iterate

---

## Support & Questions

If something doesn't work:

1. Check the **Troubleshooting** section above
2. Verify all three terminals show their "running" messages
3. Verify the Groq key and `API_BASE_URL` are valid
4. Look at terminal output for error messages (backend logs pseudonymize ids but keep full messages)
5. Re-run the quick suites: `npm test` (backend), `python -m pytest` (ai_service), `npm run lint` (frontend)
6. Try restarting all three services

Good luck! The system is now ready for testing. 🚀
