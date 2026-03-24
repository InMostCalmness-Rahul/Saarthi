# Saarthi

Saarthi is a relational AI companion prototype focused on two connected goals:

- emotional support during life transitions
- consistent progress through small, realistic actions

## What's Built

**Current Implementation**: A working React frontend with an Express.js backend API. The frontend demonstrates the full chat interface with trust score tracking, and the backend provides APIs for chat messages, action updates, and trust score management.

### Frontend (Phase 1: Complete)
- React chat application with multiple pages (Landing, Chat, Settings)
- Reusable UI components: ChatWindow, MessageBubble, TrustCard, ChatInput
- Trust score phases visualization (Listening, Momentum, Accountability)
- Mock chat engine for local testing and development
- Loading, error, and empty states
- Responsive layout with CSS styling

### Backend (Phase 2: Complete)
- Express.js API server with three core endpoints
- Request validation and consistent error handling
- HTTP logging via Morgan middleware
- Environment configuration support (.env)
- Mock in-memory data storage (ready for MongoDB integration)

## Current Architecture

The system is currently integrated locally:
- **Frontend** (React) → connects to **Backend** (Express) 
- **Backend** stores data in mock in-memory storage
- AI responses are mock-generated (placeholder only)
- Full end-to-end chat flow works with local data

This architecture is designed to easily swap out the mock components in Phase 3+ with real services (Python AI, MongoDB).

## Project Structure

```
Saarthi/
├── frontend/                  # React UI application (Phase 1: Complete)
│   ├── src/
│   │   ├── components/       # ChatWindow, MessageBubble, TrustCard, ChatInput
│   │   ├── pages/            # LandingPage, ChatPage, SettingsPage
│   │   ├── data/             # mockChatEngine.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
├── backend/                   # Express.js API (Phase 2: Complete)
│   ├── controllers/          # chatController.js - route logic
│   ├── middleware/           # errorHandler.js, validation.js
│   ├── routes/               # chatRoutes.js - /api/chat, /api/action-update, /api/trust-score
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   └── README.md
├── TODO.md                   # Roadmap: Phases 3-8
└── README.md                 # This file
```

## Tech Stack (Current)

- **Frontend**: React 18, React Router, Vite, CSS
- **Backend**: Node.js, Express.js, Morgan (HTTP logging), dotenv
- **Middleware**: CORS, JSON parsing, request validation
- **Data**: In-memory mock storage (objects)

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Running Backend

1. Navigate to backend:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment template:
   ```bash
   cp .env.example .env
   ```

4. Optional: Update `.env` for custom settings:
   ```
   PORT=5000
   NODE_ENV=development
   ```

5. Start development server (with auto-reload):
   ```bash
   npm run dev
   ```

6. Backend runs at `http://localhost:5000`

### Running Frontend

1. Navigate to frontend:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Open browser at URL shown in terminal (usually `http://localhost:5173`)

### Running Both Together

Open two terminal windows:

**Terminal 1 (Backend):**
```bash
cd backend && npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend && npm run dev
```

The frontend will automatically connect to the backend at `http://localhost:5000`. Test the full chat flow locally.

## API Endpoints

These endpoints are implemented and functional with mock data:

### POST /api/chat
Process a user message and return a bot response.

**Request:**
```json
{
  "message": "I'm feeling anxious",
  "userId": "user123",
  "sessionId": "session456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userMessage": {
      "id": "msg_123",
      "sender": "user",
      "content": "I'm feeling anxious",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    "botResponse": {
      "id": "msg_124",
      "sender": "bot",
      "content": "I hear you. Let's explore this together.",
      "emotional_validation": "Your feelings matter.",
      "tiny_action": "Take a deep breath",
      "followup_question": "What do you think would help?",
      "timestamp": "2024-01-15T10:30:01Z"
    },
    "sessionLength": 5,
    "trustScore": 55
  }
}
```

### POST /api/action-update
Record when a user completes an action and update trust score.

**Request:**
```json
{
  "userId": "user123",
  "actionCommitment": "I will take a short walk today",
  "trustScoreDelta": 5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user123",
    "actionCommitment": "I will take a short walk today",
    "trustScoreDelta": 5,
    "newTrustScore": 55,
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### GET /api/trust-score
Retrieve a user's current trust score.

**Request:**
```
GET /api/trust-score?userId=user123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user123",
    "trustScore": 55,
    "sessionLength": 5,
    "retrievedAt": "2024-01-15T10:30:00Z"
  }
}
```

## Backend Features (Current)

### Request Validation
- Validates required fields (`message`, `userId`, `actionCommitment`, `trustScoreDelta`)
- Returns 400 status with clear error messages for invalid requests
- Content-Type validation for JSON endpoints

### Error Handling
- Consistent JSON error response format
- HTTP status codes: 400 (bad request), 404 (not found), 500 (server error)
- Stack traces shown in development mode only
- User-friendly error messages

### Logging
- Morgan middleware logs all HTTP requests with method, path, status
- All errors logged to console
- Timestamps on console output for debugging

## Testing the Current State

### Manual API Testing

Using curl or Postman, test the backend directly:

```bash
# Test chat endpoint
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How are you helping me?",
    "userId": "test_user_1",
    "sessionId": "session_1"
  }'

# Test trust score endpoint
curl "http://localhost:5000/api/trust-score?userId=test_user_1"
```

### Test the Frontend-Backend Connection

1. Run both backend and frontend servers
2. Open frontend in browser
3. Type a message in the chat input
4. Verify message appears and bot response returns
5. Check browser DevTools Network tab to see API calls to `http://localhost:5000/api/chat`

## Roadmap: Next Phases

The next development phases are tracked in [TODO.md](TODO.md):

- **Phase 3**: Python AI Service (FastAPI endpoint for response generation with structured output format)
- **Phase 4**: MongoDB Data Layer (persistent user sessions, messages, and trust history)
- **Phase 5**: Integration (connecting all services for end-to-end chat with real AI and persistence)
- **Phase 6**: Safety & Ethics (crisis detection, disclaimers, consent controls)
- **Phase 7**: Proactive Engagement (reminder nudges, inactivity detection)
- **Phase 8**: Quality & Launch (unit tests, integration tests, CI/CD, documentation)

See [TODO.md](TODO.md) for detailed checklists and specific tasks for each phase.

## Development Notes

### Mock Chat Engine
The frontend uses `src/data/mockChatEngine.js` to generate responses during development. This simulates what the real AI service will do in Phase 3.

### Mock Data Storage
The backend stores messages, actions, and trust scores in plain JavaScript objects (in-memory). In Phase 4, this will be replaced with MongoDB queries.

### Environment Variables
Copy `.env.example` to `.env` to customize server port, environment (development/production), and URLs for services added in later phases.

## Contributing

Pull requests are welcome. For large changes, open an issue first to discuss scope.

Code should remain readable for developers with basic software engineering knowledge.

## License

This project is licensed under the MIT License. See the LICENSE file.
