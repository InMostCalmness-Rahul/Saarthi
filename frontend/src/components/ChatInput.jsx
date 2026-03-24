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
        disabled={disabled}
      />
      <button type="submit" disabled={disabled}>
        Send
      </button>
    </form>
  );
}

export default ChatInput;
