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

const emotionReflections = {
  lonely: "That sounds lonely, and it makes sense this feels difficult right now.",
  burnout: "You sound exhausted, and that kind of load can make everything feel harder.",
  grief: "I hear the grief in what you shared, and that weight is real.",
  "self-doubt": "I can hear the self-doubt, and this phase can feel very stuck.",
  overwhelmed: "It sounds like a lot is piling up, and that pressure is real.",
};

const reconnectionOptions = [
  "Would you be open to sending one short message to someone you trust today?",
  "Could we pick one person in your circle for a simple check-in text?",
  "Would a 5-minute reconnect with a friend or mentor feel possible today?",
];

const tinyActionOptions = [
  "Tiny step: Spend 10 minutes writing one next action for your goal.",
  "Tiny step: Do only the first 8 minutes of your next task.",
  "Tiny step: Write a 3-line plan and complete line one today.",
];

function detectEmotion(text) {
  const lowerText = text.toLowerCase();

  if (/(alone|lonely|isolated)/.test(lowerText)) return "lonely";
  if (/(burnout|exhausted|tired|drained)/.test(lowerText)) return "burnout";
  if (/(grief|loss|miss|passed away)/.test(lowerText)) return "grief";
  if (/(anxious|afraid|fear|doubt|uncertain)/.test(lowerText)) return "self-doubt";

  return "overwhelmed";
}

function pickRandomItem(list) {
  const randomIndex = Math.floor(Math.random() * list.length);
  return list[randomIndex];
}

export function getSeedMessages() {
  return seedMessages;
}

export function generateBotMessage(userText) {
  const emotion = detectEmotion(userText);
  const reflection = emotionReflections[emotion];
  const reconnection = pickRandomItem(reconnectionOptions);
  const tinyAction = pickRandomItem(tinyActionOptions);

  return [
    reflection,
    reconnection,
    tinyAction,
    "Would you like me to check in on this in your next message?",
  ].join("\n\n");
}

export function getTrustScoreDelta(userText) {
  const lowerText = userText.toLowerCase();

  if (/(done|completed|finished|i did it|sent the message)/.test(lowerText)) {
    return 3;
  }

  if (/(can't|cannot|skip|later|not now|leave it)/.test(lowerText)) {
    return -2;
  }

  return 1;
}
