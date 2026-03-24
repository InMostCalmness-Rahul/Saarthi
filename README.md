# Saarthi - An AI Companion for Support and Growth

Saarthi is an empathetic AI companion that helps people during difficult times by combining emotional validation with small, achievable actions. Instead of big advice, Saarthi listens first, validates your feelings, and suggests one tiny step forward—reconnecting you with people who matter and building momentum through consistent progress.

## How It Works

When you chat with Saarthi:
1. **You share what's on your mind** - Your feelings, challenges, or what's weighing on you
2. **Saarthi listens and validates** - Your emotions are acknowledged and validated
3. **Small action suggested** - A concrete, 5-15 minute action you can take today
4. **Progress tracked** - Your trust score reflects your journey through three phases:
   - **Listening**: Building understanding and safety
   - **Momentum**: Taking small actions forward
   - **Accountability**: Sustaining progress through connections

## Quick Start - Run the Prototype

Saarthi consists of three services working together. Follow these steps to get everything running:

### Prerequisites

- **Node.js 18+** and **npm** (for frontend and backend)
- **Python 3.8+** (for AI service)
- **OpenAI API key** (free trial available at https://platform.openai.com/api-keys)

### Step 1: Clone and Navigate

```bash
# You should be in the Saarthi root directory
cd Saarthi
```

### Step 2: Start the Backend (Express API)

Open a new terminal:

```bash
cd backend
npm install
npm run dev
```

Backend will run at: **http://localhost:5000**

### Step 3: Start the AI Service (Python FastAPI)

Open another terminal:

```bash
cd ai_service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

**Edit `.env` and add your OpenAI API key:**
```
OPENAI_API_KEY=sk-your-actual-key-here
```

Then start the service:
```bash
python main.py
```

AI Service will run at: **http://127.0.0.1:8000**

### Step 4: Start the Frontend (React UI)

Open a third terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend will open at: **http://localhost:5173**

### Step 5: Test the Chat

1. Open http://localhost:5173 in your browser
2. Type a message like: "I'm feeling overwhelmed with work"
3. Press Enter or click Send
4. Watch Saarthi respond with validation, a tiny action, and a follow-up question

**That's it!** The prototype is now running with real AI responses.

## Architecture

```
┌─────────────────────────────────────────┐
│   Browser (http://localhost:5173)       │
│         React Frontend                   │
└────────────────┬────────────────────────┘
                 │ HTTP requests
                 ↓
┌─────────────────────────────────────────┐
│   http://localhost:5000                 │
│     Express.js Backend API               │
│  (routes, validation, orchestration)    │
└────────────────┬────────────────────────┘
                 │ HTTP calls
                 ↓
┌─────────────────────────────────────────┐
│   http://127.0.0.1:8000                 │
│      Python FastAPI AI Service          │
│   (OpenAI integration, prompt logic)    │
└─────────────────────────────────────────┘
```

## What's in Each Service

### Frontend (React + Vite)
- Chat interface where users type messages
- Trust score panel showing progress
- Three pages: Landing, Chat, Settings
- Responsive, accessible design

### Backend (Express.js)
- Receives chat messages from frontend
- Calls AI service to generate responses
- Tracks trust scores and user sessions
- Returns structured responses to frontend

### AI Service (Python + FastAPI)
- Integrates with OpenAI API (GPT-3.5-turbo)
- Uses specialized prompts for different trust phases
- Detects crisis indicators and responds appropriately
- Returns structured JSON with validation, actions, questions

## Troubleshooting

### "Connection refused" when sending a message?
- Make sure all three services are running
- Check that backend (port 5000) and AI service (port 8000) are accessible
- Look for errors in the respective terminal windows

### "OPENAI_API_KEY not found"?
- Did you create `.env` file in `ai_service/`?
- Did you add your actual API key (starts with `sk-`)?
- Restart the AI service after updating `.env`

### Chat showing error message?
- Open browser DevTools (F12) and check the Console tab for details
- Verify the OpenAI API key is valid and has remaining credits  
- Check that you're not hitting rate limits (add delays between messages)

### Port already in use?
Each service uses a specific port. If one is in use:
- **Frontend (5173)**: Change in `frontend/vite.config.js`
- **Backend (5000)**: Change in `backend/.env`
- **AI Service (8000)**: Change in `ai_service/.env`

## File Structure

```
Saarthi/
├── frontend/              # React chat interface
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Chat, Landing, Settings pages
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── backend/              # Express API server
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Validation, error handling
│   ├── routes/           # API endpoints
│   ├── server.js
│   └── package.json
├── ai_service/           # Python AI service
│   ├── main.py          # FastAPI app
│   ├── ai_engine.py     # AI logic
│   ├── prompts.py       # Prompt templates
│   └── requirements.txt
└── README.md            # This file
```

## Contributing

We welcome contributions! Here's how to help:

1. **Report Issues**: Found a bug or have an idea? Open an issue with clear details

2. **Submit Code**: 
   - Fork the repository
   - Create a feature branch: `git checkout -b feature/your-feature-name`
   - Make your changes
   - Test locally with all three services running
   - Commit with clear messages: `git commit -m "Add feature: clear description"`
   - Push and open a pull request

3. **Code Style**:
   - Frontend: Keep components small and readable
   - Backend: Follow Express conventions, add validation for all inputs
   - Python: Follow PEP 8, add type hints where possible

4. **Testing**:
   - Manually test the chat flow end-to-end
   - Try different message types (emotional, action-oriented, etc.)
   - Test error scenarios (no internet, invalid API key, etc.)

## API Endpoints

### Frontend to Backend
- `POST /api/chat` - Send message, get response
- `GET /api/trust-score` - Get user's current trust score

### Backend to AI Service
- `POST /generate-response` - Get AI-generated response
- `GET /health` - Check AI service is running

## License

This project is licensed under the MIT License. See the LICENSE file for details.
