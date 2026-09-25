import { once } from 'node:events';
import { createApp } from '../../app.js';

/**
 * Boots the real Express app on an ephemeral port for HTTP-level assertions
 * (auth, validation, error envelopes) without requiring a database.
 */
export async function startTestServer() {
  const app = createApp();
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

export async function postJson(baseUrl, path, body, token) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

export async function getWithToken(baseUrl, path, token) {
  return fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
