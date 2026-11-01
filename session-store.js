import { env } from './env.js';

export class SessionStore {
  #sessions = new Map();

  get(key) {
    const session = this.#sessions.get(key);
    if (!session) return this.create(key);
    if (Date.now() - session.updatedAt > env.SESSION_TTL_MINUTES * 60_000) return this.create(key);
    session.updatedAt = Date.now();
    return session;
  }

  create(key) {
    const session = { key, state: 'WELCOME', category: null, cart: [], checkout: {}, updatedAt: Date.now() };
    this.#sessions.set(key, session);
    return session;
  }

  reset(key) { this.#sessions.delete(key); }

  clearExpired() {
    const cutoff = Date.now() - env.SESSION_TTL_MINUTES * 60_000;
    for (const [key, session] of this.#sessions) if (session.updatedAt < cutoff) this.#sessions.delete(key);
  }
}
