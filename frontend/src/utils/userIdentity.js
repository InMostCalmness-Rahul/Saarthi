const USER_KEY = "saarthi_user_id";

export function getOrCreateUserId() {
  const existing = window.localStorage.getItem(USER_KEY);
  if (existing) {
    return existing;
  }

  const created = `user_${Date.now()}`;
  window.localStorage.setItem(USER_KEY, created);
  return created;
}
