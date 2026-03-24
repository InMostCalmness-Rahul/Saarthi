import { Link } from "react-router-dom";

function LandingPage() {
  return (
    <section className="landing-page card">
      <p className="label">Relational AI Companion</p>
      <h2>Bridge emotional recovery and real-world progress.</h2>
      <p>
        Saarthi is designed for people in transition. It validates emotions, encourages human
        reconnection, and helps users take one realistic step forward.
      </p>
      <div className="cta-row">
        <Link className="primary-link" to="/chat">
          Start Chat Prototype
        </Link>
        <Link className="secondary-link" to="/settings">
          Open Settings
        </Link>
      </div>
    </section>
  );
}

export default LandingPage;
