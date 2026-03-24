import { useMemo, useState, useEffect } from "react";
import ChatInput from "../components/ChatInput";
import ChatWindow from "../components/ChatWindow";
import TrustCard from "../components/TrustCard";
import { getSeedMessages } from "../data/mockChatEngine";
import { getOrCreateUserId } from "../utils/userIdentity";

const MAX_TRUST = 100;
const MIN_TRUST = 0;
const BACKEND_URL = "http://localhost:5000";

function clampTrust(score) {
  return Math.min(MAX_TRUST, Math.max(MIN_TRUST, score));
}

function ChatPage() {
  const [messages, setMessages] = useState(getSeedMessages);
  const [trustScore, setTrustScore] = useState(30);
  const [uiState, setUiState] = useState("ready");
  const [userId] = useState(getOrCreateUserId);
  const [sessionId] = useState(`session_${Date.now()}`);

  const uiDetails = useMemo(() => {
    if (uiState === "loading") {
      return {
        label: "loading",
        message: "Starting a calm check-in session...",
      };
    }

    if (uiState === "error") {
      return {
        label: "error",
        message: "Something went wrong. Please try again in a moment.",
      };
    }

    if (messages.length === 0) {
      return {
        label: "empty",
        message: "Send the first message to begin the session.",
      };
    }

    return {
      label: "ready",
      message: "",
    };
  }, [messages.length, uiState]);

  function handleSend(userText) {
    if (uiState === "loading") {
      return;
    }

    if (userText.toLowerCase() === "simulate error") {
      setUiState("error");
      return;
    }

    setUiState("loading");

    const newUserMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: userText,
    };

    setMessages((previous) => [...previous, newUserMessage]);

    // Call backend API
    fetch(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: userText,
        userId: userId,
        sessionId: sessionId,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.data.botResponse) {
          const botMessage = {
            id: `b-${Date.now()}`,
            role: "bot",
            text: data.data.botResponse.content,
          };

          setMessages((previous) => [...previous, botMessage]);
          setTrustScore(clampTrust(data.data.trustScore));
        } else {
          throw new Error("Invalid response from backend");
        }
        setUiState("ready");
      })
      .catch((error) => {
        console.error("Error communicating with backend:", error);
        setUiState("error");
        
        // Add error message to chat
        const errorMessage = {
          id: `err-${Date.now()}`,
          role: "bot",
          text: "Sorry, I'm having trouble connecting. Please check if the backend is running at http://localhost:5000",
        };
        setMessages((previous) => [...previous, errorMessage]);
      });
  }

  function handleReset() {
    setMessages([]);
    setTrustScore(30);
    setUiState("ready");
  }

  function handleStartSeed() {
    setMessages(getSeedMessages());
    setUiState("ready");
  }

  return (
    <section className="chat-page">
      <aside className="card side-column">
        <p className="label">Saarthi</p>
        <h2>Your bridge from feeling stuck to moving forward.</h2>
        <p>
          Talk openly. Get grounded. Reconnect with people and progress one small step at a time.
        </p>
        <p className="safety-note" role="note">
          Saarthi is not a therapist or emergency service. If you are in immediate danger or thinking
          about self-harm, contact local emergency services right away.
        </p>
        <TrustCard trustScore={trustScore} />
      </aside>

      <section className="card chat-column" aria-label="Chat with Saarthi">
        <header className="chat-header">
          <div>
            <p className="label">Companion Chat</p>
            <h2>Saarthi AI</h2>
          </div>
          <div className="header-actions">
            <button type="button" className="ghost-button" onClick={handleReset}>
              Clear
            </button>
            <button type="button" className="ghost-button" onClick={handleStartSeed}>
              Restore Starter
            </button>
          </div>
        </header>

        <ChatWindow
          messages={messages}
          stateLabel={uiDetails.label}
          stateMessage={uiDetails.message}
        />

        <ChatInput onSend={handleSend} disabled={uiState === "loading"} />
      </section>
    </section>
  );
}

export default ChatPage;
