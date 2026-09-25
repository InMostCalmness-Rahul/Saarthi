import { clampTrustScore, getPhaseDetails } from "../utils/trustPhase";

function TrustCard({ trustScore, phase }) {
  const score = clampTrustScore(trustScore);
  // The server-reported phase is authoritative when available; otherwise the
  // shared threshold helper keeps the UI aligned with backend/constants.js.
  const details = getPhaseDetails(score, phase);

  return (
    <aside className="trust-card">
      <p className="label">Trust Phase</p>
      <h2>{details.name}</h2>
      <p className="hint">{details.hint}</p>
      <div className="meter" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${score}%` }} />
      </div>
      <p className="score">{score}/100</p>
    </aside>
  );
}

export default TrustCard;
