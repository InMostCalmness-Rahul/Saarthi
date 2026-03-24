import { useEffect, useState } from "react";
import { getOrCreateUserId } from "../utils/userIdentity";

const BACKEND_URL = "http://localhost:5000";

function SettingsPage() {
  const [userId] = useState(getOrCreateUserId);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadPreferences() {
      try {
        const response = await fetch(`${BACKEND_URL}/api/preferences/${userId}`);
        const result = await response.json();
        if (result.success) {
          setConsent(Boolean(result.data.proactiveNudgesConsent));
        }
      } catch (error) {
        console.error("Failed to load preferences", error);
      }
    }

    loadPreferences();
  }, [userId]);

  async function handleConsentChange(event) {
    const nextValue = event.target.checked;
    setConsent(nextValue);
    setStatus("saving");
    setMessage("Saving consent preference...");

    try {
      const response = await fetch(`${BACKEND_URL}/api/preferences/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ proactiveNudgesConsent: nextValue }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error("Could not save preference");
      }

      setStatus("done");
      setMessage("Consent preference updated.");
    } catch (error) {
      console.error("Failed to update preferences", error);
      setStatus("error");
      setMessage("Could not update preference. Please try again.");
    }
  }

  async function handleExport() {
    setStatus("saving");
    setMessage("Preparing your data export...");

    try {
      const response = await fetch(`${BACKEND_URL}/api/user-data/${userId}/export`);
      const result = await response.json();
      if (!result.success) {
        throw new Error("Could not export user data");
      }

      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `saarthi-data-${userId}.json`;
      link.click();
      URL.revokeObjectURL(downloadUrl);

      setStatus("done");
      setMessage("Data export downloaded.");
    } catch (error) {
      console.error("Failed to export data", error);
      setStatus("error");
      setMessage("Data export failed. Please try again.");
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "This will permanently delete your Saarthi data. This action cannot be undone. Continue?"
    );
    if (!confirmed) return;

    setStatus("saving");
    setMessage("Deleting your data...");

    try {
      const response = await fetch(`${BACKEND_URL}/api/user-data/${userId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error("Could not delete user data");
      }

      setConsent(false);
      setStatus("done");
      setMessage("Your data has been deleted.");
    } catch (error) {
      console.error("Failed to delete user data", error);
      setStatus("error");
      setMessage("Delete failed. Please try again.");
    }
  }

  return (
    <section className="card settings-page">
      <p className="label">Profile / Settings</p>
      <h2>Personalization and consent controls</h2>
      <p>
        Manage reminder consent and privacy controls for your Saarthi account.
      </p>

      <div className="setting-row">
        <label htmlFor="consent-toggle">Allow proactive reminder nudges</label>
        <input
          id="consent-toggle"
          type="checkbox"
          checked={consent}
          onChange={handleConsentChange}
        />
      </div>

      <div className="setting-actions">
        <button type="button" className="ghost-button" onClick={handleExport}>
          Export My Data
        </button>
        <button type="button" className="danger-button" onClick={handleDelete}>
          Delete My Data
        </button>
      </div>

      {status !== "idle" ? <p className={`hint ${status === "error" ? "error-text" : ""}`}>{message}</p> : null}
    </section>
  );
}

export default SettingsPage;
