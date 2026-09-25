import { useEffect, useMemo, useState } from "react";
import ChatInput from "../components/ChatInput";
import ChatWindow from "../components/ChatWindow";
import TrustCard from "../components/TrustCard";
import { getSeedMessages } from "../data/seedMessages";
import { apiRequest } from "../utils/apiClient";
import { ensureSession, withSession } from "../utils/session";
import { TRUST_SCORE_DEFAULT, clampTrustScore } from "../utils/trustPhase";

const CRISIS_FLAG = "CRISIS_DETECTED";

function createSessionId() {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `session_${random}`;
}

function ChatPage() {
  const [messages, setMessages] = useState(getSeedMessages);
  const [session, setSession] = useState(null);
  const [trustScore, setTrustScore] = useState(TRUST_SCORE_DEFAULT);
  const [trustPhase, setTrustPhase] = useState(null);
  const [uiState, setUiState] = useState("loading");
  const [notice, setNotice] = useState(null);
  const [pendingActionId, setPendingActionId] = useState(null);
  const [resolvedActions, setResolvedActions] = useState({});
  const [sessionId] = useState(createSessionId);

  // Identity + trust score now come from the server. The previous UI hardcoded a
  // starting score of 30 while the backend seeded 50, so users saw a different
  // phase than the one actually used for prompting.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const activeSession = await ensureSession();
        const trust = await apiRequest("/api/trust-score", { token: activeSession.token });
        if (cancelled) {
          return;
        }
        setSession(activeSession);
        setTrustScore(clampTrustScore(trust.trustScore));
        setTrustPhase(trust.phase ?? null);
        setUiState("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }
        setNotice({ tone: "error", text: error.message });
        setUiState("error");
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // Only the most recent bot turn drives the crisis panel.
  const crisisActive = useMemo(() => {
    const lastBotMessage = [...messages].reverse().find((message) => message.role === "bot");
    return Boolean(lastBotMessage?.riskFlags?.includes(CRISIS_FLAG));
  }, [messages]);

  const uiDetails = useMemo(() => {
    if (uiState === "loading" || uiState === "sending") {
      return {
        label: "loading",
        message: uiState === "sending" ? "Saarthi is thinking..." : "Starting a calm check-in session...",
      };
    }

    if (uiState === "error") {
      return {
        label: "error",
        message: notice?.text || "Something went wrong. Please try again in a moment.",
      };
    }

    if (messages.length === 0) {
      return { label: "empty", message: "Send the first message to begin the session." };
    }

    return { label: "ready", message: "" };
  }, [messages.length, notice, uiState]);

  async function handleSend(userText) {
    if (uiState === "loading" || uiState === "sending") {
      return;
    }

    if (userText.toLowerCase() === "simulate error") {
      setNotice({ tone: "error", text: "Simulated failure for manual QA." });
      setUiState("error");
      return;
    }

    setNotice(null);
    setUiState("sending");
    setMessages((previous) => [...previous, { id: `u-${Date.now()}`, role: "user", text: userText }]);

    try {
      const data = await withSession((activeSession) =>
        apiRequest("/api/chat", {
          method: "POST",
          body: { message: userText, sessionId },
          token: activeSession.token,
        })
      );

      const bot = data.botResponse;
      setMessages((previous) => [
        ...previous,
        {
          id: bot.id ?? `b-${Date.now()}`,
          role: "bot",
          text: bot.content,
          tinyAction: bot.tiny_action,
          riskFlags: bot.risk_flags,
        },
      ]);
      setTrustScore(clampTrustScore(data.trustScore));
      setTrustPhase(data.trustPhase ?? null);

      if (data.fallbackUsed) {
        setNotice({
          tone: "info",
          text: "Saarthi is running in a limited mode right now, so replies may be simpler than usual.",
        });
      }

      setUiState("ready");
    } catch (error) {
      // The chat stays on screen; the failure is surfaced as a notice instead.
      setNotice({ tone: "error", text: error.message });
      setUiState("ready");
      setMessages((previous) => [
        ...previous,
        {
          id: `err-${Date.now()}`,
          role: "bot",
          text:
            "I could not reach Saarthi just now. If you are in immediate danger, please contact your local emergency services right away.",
        },
      ]);
    }
  }

  // Records whether the suggested tiny action was done. The trust delta is
  // computed by the server; the client only reports `completed`.
  async function handleActionDecision(message, completed) {
    setPendingActionId(message.id);
    try {
      const data = await withSession((activeSession) =>
        apiRequest("/api/action-update", {
          method: "POST",
          body: { actionCommitment: message.tinyAction, completed, sessionId },
          token: activeSession.token,
        })
      );

      setResolvedActions((previous) => ({ ...previous, [message.id]: completed ? "done" : "skipped" }));
      setTrustScore(clampTrustScore(data.trustScore));
      setTrustPhase(data.trustPhase ?? null);
      setMessages((previous) => [
        ...previous,
        {
          id: `ack-${Date.now()}`,
          role: "bot",
          text: completed
            ? "Thank you for telling me - noticing progress matters as much as the step itself."
            : "That is okay. Small steps are optional, and we can look at it again whenever you want.",
        },
      ]);
    } catch (error) {
      setNotice({ tone: "error", text: error.message });
    } finally {
      setPendingActionId(null);
    }
  }

  function handleReset() {
    setMessages([]);
    setTrustScore(TRUST_SCORE_DEFAULT);
    setTrustPhase(null);
    setResolvedActions({});
    setNotice(null);
    setUiState("ready");
  }

  function handleStartSeed() {
    setMessages(getSeedMessages());
    setResolvedActions({});
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
        <TrustCard trustScore={trustScore} phase={trustPhase} />
        {session ? <p className="score">Session {session.userId}</p> : null}
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

        {crisisActive ? (
          <section className="crisis-panel" role="alert">
            <h3>You deserve immediate support from a real person</h3>
            <p>
              Please reach out to someone you trust right now and contact a crisis line or emergency
              service. You do not have to carry this alone.
            </p>
            <ul>
              <li>If you are in immediate danger, call your local emergency number.</li>
              <li>United States: call or text 988.</li>
              <li>Anywhere else: find a helpline at findahelpline.com</li>
            </ul>
          </section>
        ) : null}

        {notice ? (
          <p className={`notice ${notice.tone === "error" ? "error-text" : ""}`} role="status">
            {notice.text}
          </p>
        ) : null}

        <ChatWindow
          messages={messages}
          stateLabel={uiDetails.label}
          stateMessage={uiDetails.message}
          pendingActionId={pendingActionId}
          resolvedActions={resolvedActions}
          onActionDecision={handleActionDecision}
        />

        <ChatInput onSend={handleSend} disabled={uiState === "loading" || uiState === "sending"} />
      </section>
    </section>
  );
}

export default ChatPage;
