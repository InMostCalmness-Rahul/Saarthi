const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:5000";
const TEST_USER_ID = process.env.TEST_USER_ID || `e2e_user_${Date.now()}`;
const TEST_SESSION_ID = process.env.TEST_SESSION_ID || `e2e_session_${Date.now()}`;

async function apiFetch(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (error) {
    const details = error?.cause?.message || error.message;
    throw new Error(
      `Could not reach backend at ${BACKEND_URL}. Start backend with \"npm run dev\" before running this test. (${details})`
    );
  }
}

async function run() {
  console.log("Running Saarthi E2E chat flow...");

  const chatResponse = await apiFetch(`${BACKEND_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: "I feel overwhelmed and need a small next step.",
      userId: TEST_USER_ID,
      sessionId: TEST_SESSION_ID,
    }),
  });

  if (!chatResponse.ok) {
    throw new Error(`Chat request failed with status ${chatResponse.status}`);
  }

  const chatResult = await chatResponse.json();
  if (!chatResult.success || !chatResult.data?.botResponse?.content) {
    throw new Error("Chat response payload did not contain expected bot response data");
  }

  console.log("Chat endpoint OK");

  const trustResponse = await apiFetch(`${BACKEND_URL}/api/trust-score/${TEST_USER_ID}`);
  if (!trustResponse.ok) {
    throw new Error(`Trust score request failed with status ${trustResponse.status}`);
  }

  const trustResult = await trustResponse.json();
  if (!trustResult.success || typeof trustResult.data?.trustScore !== "number") {
    throw new Error("Trust score payload did not contain a numeric trustScore");
  }

  console.log("Trust score endpoint OK");

  const exportResponse = await apiFetch(`${BACKEND_URL}/api/user-data/${TEST_USER_ID}/export`);
  if (!exportResponse.ok) {
    throw new Error(`Export request failed with status ${exportResponse.status}`);
  }

  const exportResult = await exportResponse.json();
  if (!exportResult.success || !Array.isArray(exportResult.data?.messages)) {
    throw new Error("Export payload did not contain expected messages array");
  }

  console.log("Data export endpoint OK");
  console.log("E2E flow passed successfully");
}

run().catch((error) => {
  console.error("E2E flow failed:", error.message);
  process.exit(1);
});
