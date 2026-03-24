function TrustCard({ trustScore }) {
  let phaseName = "Listening Mode";
  let phaseHint = "I am focused on understanding what you are feeling without pushing too fast.";

  if (trustScore >= 40 && trustScore <= 69) {
    phaseName = "Momentum Mode";
    phaseHint = "I will keep validating feelings while guiding one small next step.";
  }

  if (trustScore >= 70) {
    phaseName = "Accountability Mode";
    phaseHint = "I can now offer more direct pattern feedback with empathy.";
  }

  return (
    <aside className="trust-card">
      <p className="label">Trust Phase</p>
      <h2>{phaseName}</h2>
      <p className="hint">{phaseHint}</p>
      <div className="meter" role="progressbar" aria-valuenow={trustScore} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${trustScore}%` }} />
      </div>
      <p className="score">{trustScore}/100</p>
    </aside>
  );
}

export default TrustCard;
