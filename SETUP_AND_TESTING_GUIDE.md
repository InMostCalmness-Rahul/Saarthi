# Saarthi - Complete Setup & Testing Guide

## Prerequisites
Ensure you have the following installed:
- **Node.js** (v16+) - Get it from https://nodejs.org/
- **Python** (3.8+) - Get it from https://www.python.org/
- **npm** (comes with Node.js)
- **pip** (Python package manager - usually comes with Python)
- An **LLM API Key** (OpenAI or Groq)

## Step 1: Configure Your LLM API Key

**Before you start:** You MUST add a valid API key to the AI service:

1. Open this file: `ai_service/.env`
2. Use one of these options:
   ```
    # Option A: OpenAI
    OPENAI_API_KEY=sk-your-openai-key
    API_BASE_URL=https://api.openai.com/v1
    MODEL=gpt-4o-mini

    # Option B: Groq (OpenAI-compatible)
    GROQ_API_KEY=gsk_your_groq_key
    API_BASE_URL=https://api.groq.com/openai/v1
    MODEL=llama-3.1-8b-instant
   ```
3. Save the file

Without this step, the AI service will return fallback responses.

---

## Step 2: Install Backend Dependencies

Open a terminal and run:

```bash
cd "c:\Users\rahul\OneDrive\Desktop\Project1\Saarthi\backend"
npm install
```

This installs Express, axios, Morgan, CORS, and other Node packages.

---

## Step 3: Install Frontend Dependencies

Open a **new terminal** and run:

```bash
cd "c:\Users\rahul\OneDrive\Desktop\Project1\Saarthi\frontend"
npm install
```

This installs React, React Router, Vite, and other packages.

---

## Step 4: Install Python AI Service Dependencies

Open a **new terminal** and run:

```bash
cd "c:\Users\rahul\OneDrive\Desktop\Project1\Saarthi\ai_service"
pip install -r requirements.txt
```

This installs FastAPI, Pydantic, uvicorn, OpenAI client, and other Python packages.

---

## Step 5: Run All Three Services

Now you'll start three separate services. **Open three different terminal windows** and run them simultaneously:

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
2. **Click the Chat button** on the landing page
3. **Type a test message**, for example:
   - "I'm feeling really overwhelmed with work"
   - "I don't know if I can keep going"
   - "I want to make a positive change"
4. **Press Enter** to send the message
5. **Watch the response appear** from the AI service

---

## How Data Flows Through the System

```
Frontend (React)
    ↓ (Sends message)
Backend (Express)
    ↓ (Calls AI service)
AI Service (Python FastAPI)
    ↓ (Calls OpenAI API)
Configured LLM Provider (OpenAI or Groq)
    ↓ (Returns response)
AI Service → Backend → Frontend
    ↓ (Updates chat & trust score)
User sees bot's empathetic response
```

---

## Troubleshooting

### **"Cannot connect to backend" error in browser console**
- Make sure Terminal 1 (backend) is running
- Check that you see `Server running on port 5000`
- If not, run `npm run dev` again with correct path

### **"Error calling AI service" in backend terminal**
- Make sure Terminal 2 (AI service) is running
- Check that you see `Uvicorn running on http://127.0.0.1:8000`
- Verify `OPENAI_API_KEY` is set correctly in `ai_service/.env`

### **"Invalid API key" error in AI service terminal**
- Go to `ai_service/.env` and confirm the key for your provider is correct
- OpenAI keys start with `sk-`; Groq keys start with `gsk_`
- Also verify `API_BASE_URL` matches your provider

### **Chat doesn't send when pressing Enter**
- Make sure you're using the latest code (we added Enter key support)
- Try clicking the Send button as backup
- Check browser console (F12) for errors

### **"UnicodeDecodeError" or encoding errors on Windows**
- Try running Python with: `python -u main.py`
- Or use: `chcp 65001` first (to set terminal to UTF-8)

### **Port already in use (Address already in use)**
- If port 5000 is taken: Change `PORT` in `backend/.env` to something like `5001`
- If port 8000 is taken: Change `PORT` in `ai_service/.env` to something like `8001`
- Update `AI_SERVICE_URL` in `backend/.env` to match
- Update fetch URL in `frontend/src/pages/ChatPage.jsx` if needed

---

## File Structure Reference

```
Saarthi/
├── frontend/              # React UI
│   ├── src/
│   │   ├── pages/
│   │   │   └── ChatPage.jsx    # Main chat interface
│   │   ├── components/
│   │   │   ├── ChatInput.jsx   # Message input (Enter key works here)
│   │   │   └── ChatWindow.jsx  # Message display
│   │   └── App.jsx
│   └── package.json       # npm dependencies
│
├── backend/               # Express API
│   ├── controllers/
│   │   └── chatController.js   # Calls AI service (http://127.0.0.1:8000)
│   ├── server.js          # Express setup
│   ├── .env               # Configuration (AI_SERVICE_URL=http://127.0.0.1:8000)
│   └── package.json       # npm dependencies
│
├── ai_service/            # Python FastAPI
│   ├── main.py            # Receives requests from backend
│   ├── ai_engine.py       # Calls OpenAI-compatible API (OpenAI or Groq)
│   ├── config.py          # Settings management
│   ├── prompts.py         # AI response templates
│   ├── .env               # LLM provider key/config goes here
│   └── requirements.txt    # Python dependencies
│
└── README.md              # Main documentation
```

---

## Next Steps After Testing

Once you confirm the system works:
1. Customize AI prompts in `ai_service/prompts.py`
2. Add database persistence (MongoDB setup in progress)
3. Deploy to production
4. Gather user feedback and iterate

---

## Support & Questions

If something doesn't work:
1. Check the **Troubleshooting** section above
2. Verify all three terminals show "running" messages
3. Check that provider key and `API_BASE_URL` are valid
4. Look at terminal output for error messages
5. Try restarting all three services

Good luck! The system is now ready for testing. 🚀
