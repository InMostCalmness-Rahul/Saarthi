function MessageBubble({ role, text }) {
  const rowClassName = role === "user" ? "message-row user" : "message-row bot";

  return (
    <article className={rowClassName}>
      <div className="avatar" aria-hidden="true" />
      <div className="bubble">{text}</div>
    </article>
  );
}

export default MessageBubble;
