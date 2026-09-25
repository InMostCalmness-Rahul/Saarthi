// Static conversation starter shown before the first exchange.
// The previous mock engine also contained client-side trust math
// (getTrustScoreDelta) which is now server-authoritative, so it was removed to
// avoid two competing sources of truth.
const seedMessages = [
  {
    id: "m1",
    role: "bot",
    text: "Hi, I am Saarthi. I listen first and then guide one small next step.",
  },
  {
    id: "m2",
    role: "bot",
    text: "What is feeling heavy for you today?",
  },
];

export function getSeedMessages() {
  return seedMessages.map((message) => ({ ...message }));
}
