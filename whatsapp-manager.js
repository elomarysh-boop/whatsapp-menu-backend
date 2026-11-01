import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'node:path';
import fs from 'node:fs/promises';
import { env } from './env.js';
import { logger } from './logger.js';
import { OutboundQueue } from './outbound-queue.js';
import { handleInboundMessage } from './bot-service.js';

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
    const sock = makeWASocket({
      auth: state,
      usePairingCode: env.WA_USE_PAIRING_CODE,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      logger
    });
    const record = { sock, store, reconnecting: false, pairingRequested: false };
    this.#clients.set(store.id, record);

    sock.ev.on('creds.update', saveCreds);
    const requestPairingCode = async () => {
      if (!env.WA_USE_PAIRING_CODE || state.creds.registered || record.pairingRequested) return;
      const phoneNumber = String(store.phone_number ?? '').replace(/\D/g, '');
      if (!phoneNumber) {
        logger.error({ storeId: store.id }, 'Cannot request WhatsApp pairing code: store.phone_number is missing');
        return;
      }
      record.pairingRequested = true;
      try {
        const pairingCode = await sock.requestPairingCode(phoneNumber);
        logger.info({ storeId: store.id, pairingCode }, 'WHATSAPP PAIRING CODE - enter it in Linked devices');
        console.log(`WHATSAPP PAIRING CODE [${store.id}]: ${pairingCode}`);
      } catch (error) {
        record.pairingRequested = false;
        logger.error({ error, storeId: store.id }, 'Failed to request WhatsApp pairing code');
        console.error('PAIRING CODE ERROR:', error);
      }
    };
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (connection === 'connecting') setTimeout(requestPairingCode, 1500);
      if (qr && !env.WA_USE_PAIRING_CODE) logger.warn({ storeId: store.id }, 'WhatsApp QR received while pairing code mode is disabled');
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
