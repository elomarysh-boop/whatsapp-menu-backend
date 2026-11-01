import { randomInt, sleep } from '../utils/helpers.js';
import { env } from '../config/env.js';

export class OutboundQueue {
  #queues = new Map();
  #lastSentAt = new Map();

  enqueue(storeId, task) {
    const previous = this.#queues.get(storeId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const minDelay = randomInt(env.OUTBOUND_MIN_DELAY_MS, env.OUTBOUND_MAX_DELAY_MS);
        const elapsed = Date.now() - (this.#lastSentAt.get(storeId) ?? 0);
        if (elapsed < minDelay) await sleep(minDelay - elapsed);
        const result = await task();
        this.#lastSentAt.set(storeId, Date.now());
        return result;
      });
    this.#queues.set(storeId, next);
    return next.finally(() => {
      if (this.#queues.get(storeId) === next) this.#queues.delete(storeId);
    });
  }

  clear(storeId) { this.#queues.delete(storeId); this.#lastSentAt.delete(storeId); }
}
