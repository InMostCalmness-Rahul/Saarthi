import { useMemo, useState } from "react";
import ChatInput from "../components/ChatInput";
import ChatWindow from "../components/ChatWindow";
import TrustCard from "../components/TrustCard";
import { generateBotMessage, getSeedMessages, getTrustScoreDelta } from "../data/mockChatEngine";

const MAX_TRUST = 100;
const MIN_TRUST = 0;

function clampTrust(score) {
  return Math.min(MAX_TRUST, Math.max(MIN_TRUST, score));
}

function ChatPage() {
  const [messages, setMessages] = useState(getSeedMessages);
  const [trustScore, setTrustScore] = useState(30);
  const [uiState, setUiState] = useState("ready");

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

    const trustDelta = getTrustScoreDelta(userText);
    setMessages((previous) => [...previous, newUserMessage]);
    setTrustScore((previous) => clampTrust(previous + trustDelta));

    window.setTimeout(() => {
      const botMessage = {
        id: `b-${Date.now()}`,
        role: "bot",
        text: generateBotMessage(userText),
      };

      setMessages((previous) => [...previous, botMessage]);
      setUiState("ready");
    }, 350);
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
