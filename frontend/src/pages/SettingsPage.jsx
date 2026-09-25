import { useEffect, useState } from "react";
import { apiRequest } from "../utils/apiClient";
import { clearSession, ensureSession, withSession } from "../utils/session";

function SettingsPage() {
  const [session, setSession] = useState(null);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      try {
        const activeSession = await ensureSession();
        const preferences = await apiRequest("/api/preferences", { token: activeSession.token });
        if (cancelled) {
          return;
        }
        setSession(activeSession);
        setConsent(Boolean(preferences.proactiveNudgesConsent));
      } catch (error) {
        if (cancelled) {
          return;
        }
        setStatus("error");
        setMessage(error.message);
      }
    }

    loadPreferences();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConsentChange(event) {
    const nextValue = event.target.checked;
    setConsent(nextValue);
    setStatus("saving");
    setMessage("Saving consent preference...");

    try {
      const preferences = await withSession((activeSession) =>
        apiRequest("/api/preferences", {
          method: "PUT",
          body: { proactiveNudgesConsent: nextValue },
          token: activeSession.token,
        })
      );

      setConsent(Boolean(preferences.proactiveNudgesConsent));
      setStatus("done");
      setMessage("Consent preference updated.");
    } catch (error) {
      setConsent(!nextValue);
      setStatus("error");
      setMessage(error.message);
    }
  }

  async function handleExport() {
    setStatus("saving");
    setMessage("Preparing your data export...");

    try {
      const exported = await withSession((activeSession) =>
        apiRequest("/api/user-data/export", { token: activeSession.token })
      );

      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `saarthi-data-${exported.userId}.json`;
      link.click();
      URL.revokeObjectURL(downloadUrl);

      setStatus("done");
      setMessage("Data export downloaded.");
    } catch (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "This will permanently delete your Saarthi data. This action cannot be undone. Continue?"
    );
    if (!confirmed) {
      return;
    }

    setStatus("saving");
    setMessage("Deleting your data...");

    try {
      await withSession((activeSession) =>
        apiRequest("/api/user-data", { method: "DELETE", token: activeSession.token })
      );

      // The deleted identity must not keep being reused, so the next visit
      // starts from a freshly minted session.
      clearSession();
      setConsent(false);
      setStatus("done");
      setMessage("Your data has been deleted. A new anonymous session will start on your next chat.");
    } catch (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  return (
    <section className="card settings-page">
      <p className="label">Profile / Settings</p>
      <h2>Personalization and consent controls</h2>
      <p>Manage reminder consent and privacy controls for your Saarthi account.</p>
      {session ? <p className="score">Anonymous session: {session.userId}</p> : null}

      <div className="setting-row">
        <label htmlFor="consent-toggle">Allow proactive reminder nudges</label>
        <input
          id="consent-toggle"
          type="checkbox"
          checked={consent}
          onChange={handleConsentChange}
          disabled={status === "saving"}
        />
      </div>

      <div className="setting-actions">
        <button type="button" className="ghost-button" onClick={handleExport} disabled={status === "saving"}>
          Export My Data
        </button>
        <button type="button" className="danger-button" onClick={handleDelete} disabled={status === "saving"}>
          Delete My Data
        </button>
      </div>

      {status !== "idle" ? (
        <p className={`hint ${status === "error" ? "error-text" : ""}`} role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}

export default SettingsPage;
