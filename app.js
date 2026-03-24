// ----- DOM ELEMENTS -----
const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const resetButton = document.getElementById("resetBtn");
const messageTemplate = document.getElementById("messageTemplate");

const trustScoreElement = document.getElementById("trustScore");
const trustMeterBar = document.getElementById("trustMeterBar");
const trustPhaseElement = document.getElementById("trustPhase");
const trustHintElement = document.getElementById("trustHint");

// ----- APP STATE -----
const INITIAL_TRUST_SCORE = 30;
const BOT_RESPONSE_DELAY_MS = 350;
const TEXTAREA_MAX_HEIGHT = 140;

const state = {
  trustScore: INITIAL_TRUST_SCORE,
};

// ----- STATIC DATA -----
const TRUST_PHASES = [
  {
    maxScore: 39,
    name: "Listening Mode",
    hint: "I am focused on understanding what you are feeling without pushing you too fast.",
  },
  {
    maxScore: 69,
    name: "Momentum Mode",
    hint: "I will keep validating your feelings while helping you choose one small next step.",
  },
  {
    maxScore: 100,
    name: "Accountability Mode",
    hint: "I can now challenge patterns gently and help you stay consistent with meaningful actions.",
  },
];

const STARTER_MESSAGES = [
  {
    role: "bot",
    text: "Hi, I am Saarthi. I am here to listen first, then help you reconnect and take one small step forward.",
  },
  {
    role: "bot",
    text: "What is feeling heavy for you today?",
  },
];

const EMOTION_REFLECTIONS = {
  lonely: "That sounds lonely, and it makes sense this feels difficult right now.",
  burnout: "You sound exhausted, and that kind of load can make everything feel harder.",
  grief: "I hear the grief in what you shared, and that weight is real.",
  "self-doubt": "I can hear the self-doubt, and it is understandable to feel stuck in this phase.",
  overwhelmed: "It sounds like a lot is piling up, and that pressure is real.",
};

const RECONNECTION_PROMPTS = [
  "Would you be open to sending a short message to one person you trust today?",
  "Could we pick one person in your circle and reconnect with a simple check-in text?",
  "Would reaching out to a friend or mentor for 5 minutes feel possible today?",
];

const TINY_ACTION_PROMPTS = [
  "Tiny step: Spend 10 minutes writing one next action for your goal and when you will do it.",
  "Tiny step: Open your task and do just the first 8 minutes, no pressure to finish.",
  "Tiny step: Write a 3-line plan for tomorrow and complete line one today.",
];

// ----- UTILITY FUNCTIONS -----
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pickRandomItem(list) {
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

function getTrustPhase(score) {
  return TRUST_PHASES.find((phase) => score <= phase.maxScore) || TRUST_PHASES[TRUST_PHASES.length - 1];
}

// ----- UI FUNCTIONS -----
function updateTrustCard() {
  const phase = getTrustPhase(state.trustScore);

  trustScoreElement.textContent = String(state.trustScore);
  trustMeterBar.style.width = `${state.trustScore}%`;
  trustPhaseElement.textContent = phase.name;
  trustHintElement.textContent = phase.hint;
}

function addMessage(role, text) {
  const messageNode = messageTemplate.content.firstElementChild.cloneNode(true);
  messageNode.classList.add(role);

  const avatar = messageNode.querySelector(".avatar");
  avatar.setAttribute("aria-hidden", "true");

  const bubble = messageNode.querySelector(".bubble");
  bubble.textContent = text;

  chatWindow.appendChild(messageNode);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function resizeMessageInput() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
}

// ----- CHAT LOGIC -----
function detectPrimaryEmotion(userText) {
  const lowerText = userText.toLowerCase();

  if (/(alone|lonely|isolated)/.test(lowerText)) return "lonely";
  if (/(burnout|exhausted|tired|drained)/.test(lowerText)) return "burnout";
  if (/(grief|loss|miss|passed away)/.test(lowerText)) return "grief";
  if (/(anxious|afraid|fear|doubt|uncertain)/.test(lowerText)) return "self-doubt";

  return "overwhelmed";
}

function buildBotReply(userText) {
  const emotion = detectPrimaryEmotion(userText);
  const reflection = EMOTION_REFLECTIONS[emotion];
  const reconnectionPrompt = pickRandomItem(RECONNECTION_PROMPTS);
  const tinyActionPrompt = pickRandomItem(TINY_ACTION_PROMPTS);

  return [
    reflection,
    reconnectionPrompt,
    tinyActionPrompt,
    "Would you like me to check in on this in your next message?",
  ].join("\n\n");
}

function updateTrustScore(userText) {
  const lowerText = userText.toLowerCase();

  const completedPattern = /(done|completed|finished|i did it|sent the message)/;
  const disengagedPattern = /(can't|cannot|skip|later|not now|leave it)/;

  if (completedPattern.test(lowerText)) {
    state.trustScore = clamp(state.trustScore + 3, 0, 100);
    return;
  }

  if (disengagedPattern.test(lowerText)) {
    state.trustScore = clamp(state.trustScore - 2, 0, 100);
    return;
  }

  state.trustScore = clamp(state.trustScore + 1, 0, 100);
}

function resetChat() {
  chatWindow.innerHTML = "";
  state.trustScore = INITIAL_TRUST_SCORE;
  updateTrustCard();

  STARTER_MESSAGES.forEach((message, index) => {
    window.setTimeout(() => {
      addMessage(message.role, message.text);
    }, 120 * index);
  });
}

function handleMessageSubmit(event) {
  event.preventDefault();

  const userText = messageInput.value.trim();
  if (!userText) return;

  addMessage("user", userText);
  messageInput.value = "";
  resizeMessageInput();

  updateTrustScore(userText);
  updateTrustCard();

  window.setTimeout(() => {
    addMessage("bot", buildBotReply(userText));
  }, BOT_RESPONSE_DELAY_MS);
}

// ----- EVENT LISTENERS -----
chatForm.addEventListener("submit", handleMessageSubmit);
messageInput.addEventListener("input", resizeMessageInput);
resetButton.addEventListener("click", resetChat);

// ----- INITIAL PAGE LOAD -----
resetChat();
