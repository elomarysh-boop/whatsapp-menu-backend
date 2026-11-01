import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';
import path from 'node:path';
import fs from 'node:fs/promises';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { OutboundQueue } from './outbound-queue.js';
import { handleInboundMessage } from '../services/bot-service.js';

export class WhatsAppManager {
  #clients = new Map();
  #queue = new OutboundQueue();
  #onInbound;

  constructor(onInbound = handleInboundMessage) { this.#onInbound = onInbound; }

  async connectStore(store) {
    if (this.#clients.has(store.id)) return this.#clients.get(store.id).sock;
    const authPath = path.resolve(env.WA_AUTH_DIR, String(store.id));
    await fs.mkdir(authPath, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const sock = makeWASocket({ auth: state, printQRInTerminal: false, markOnlineOnConnect: false, syncFullHistory: false, logger });
    const record = { sock, store, reconnecting: false };
    this.#clients.set(store.id, record);

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) qrcode.generate(qr, { small: true });
      if (connection === 'open') logger.info({ storeId: store.id }, 'WhatsApp store session connected');
      if (connection === 'close') {
        const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
        this.#clients.delete(store.id);
        this.#queue.clear(store.id);
        if (code !== DisconnectReason.loggedOut && !record.reconnecting) {
          record.reconnecting = true;
          setTimeout(() => this.connectStore(store).catch((error) => logger.error({ error, storeId: store.id }, 'Reconnect failed')), 3000);
        }
      }
    });
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const message of messages) {
        if (message.key.fromMe || !message.message || !message.key.remoteJid || message.key.remoteJid.endsWith('@g.us')) continue;
        try { await this.#onInbound({ store, sock, message, send: (text) => this.sendText(store.id, message.key.remoteJid, text) }); }
        catch (error) { logger.error({ error, storeId: store.id, jid: message.key.remoteJid }, 'Inbound handler failed'); }
      }
    });
    return sock;
  }

  async sendText(storeId, jid, text) {
    const client = this.#clients.get(storeId);
    if (!client) throw new Error(`No active WhatsApp session for store ${storeId}`);
    return this.#queue.enqueue(storeId, () => client.sock.sendMessage(jid, { text }));
  }

  async disconnectAll() {
    for (const { sock } of this.#clients.values()) sock.ws?.close();
    this.#clients.clear();
  }
}
