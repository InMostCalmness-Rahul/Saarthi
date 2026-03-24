import MessageBubble from "./MessageBubble";

function ChatWindow({ messages, stateLabel, stateMessage }) {
  if (stateLabel === "loading") {
    return (
      <section className="state-panel" aria-live="polite">
        <h3>Loading conversation...</h3>
        <p>{stateMessage}</p>
      </section>
    );
  }

  if (stateLabel === "error") {
    return (
      <section className="state-panel error" aria-live="assertive">
        <h3>Could not load chat</h3>
        <p>{stateMessage}</p>
      </section>
    );
  }

  if (messages.length === 0) {
    return (
      <section className="state-panel" aria-live="polite">
        <h3>No messages yet</h3>
        <p>{stateMessage}</p>
      </section>
    );
  }

  return (
    <section className="chat-window" aria-live="polite">
      {messages.map((message) => (
        <MessageBubble key={message.id} role={message.role} text={message.text} />
      ))}
    </section>
  );
}

export default ChatWindow;
