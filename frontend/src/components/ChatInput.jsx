import { useState } from "react";

function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    onSend(trimmed);
    setText("");
  }

  function handleKeyDown(event) {
    // Send on Enter, but allow Shift+Enter for new lines
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  }

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <label htmlFor="chatMessage" className="sr-only">
        Type your message
      </label>
      <textarea
        id="chatMessage"
        rows={2}
        placeholder="Share what is weighing on you..."
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <button type="submit" disabled={disabled}>
        Send
      </button>
    </form>
  );
}

export default ChatInput;
