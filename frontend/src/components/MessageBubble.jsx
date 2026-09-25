const CRISIS_FLAG = "CRISIS_DETECTED";

function MessageBubble({ role, text, tinyAction, riskFlags = [], actionState, onActionDecision, disabled }) {
  const isCrisis = Array.isArray(riskFlags) && riskFlags.includes(CRISIS_FLAG);
  const rowClassName = role === "user" ? "message-row user" : "message-row bot";

  return (
    <article className={rowClassName}>
      <div className="avatar" aria-hidden="true" />
      <div className={isCrisis ? "bubble crisis" : "bubble"}>
        <span className="bubble-text">{text}</span>

        {isCrisis ? (
          <p className="bubble-flag" role="status">
            This message has been flagged for safety. Support resources are shown above.
          </p>
        ) : null}

        {role === "bot" && tinyAction ? (
          <div className="tiny-action">
            <p className="tiny-action-title">Tiny step: {tinyAction}</p>
            {actionState ? (
              <p className="hint">
                {actionState === "done"
                  ? "Marked as done — that counts."
                  : "Marked as not now — that is okay, we can revisit it later."}
              </p>
            ) : (
              <div className="tiny-action-buttons">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onActionDecision?.(true)}
                  disabled={disabled}
                >
                  I did it
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onActionDecision?.(false)}
                  disabled={disabled}
                >
                  Not now
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default MessageBubble;
