import { getCategories, getCategoryByNumber, getProducts, getProductByNumber, insertOrder } from './repositories.js';
import { cartMessage, categoryMessage, checkoutMessage, prompts, welcomeMessage } from './templates.js';

import { parseCartItem, parseMenuNumber } from './parser.js';
import { normalizePhone, normalizeText } from './helpers.js';
import { SessionStore } from './session-store.js';
import { env } from './env.js';
import { logger } from './logger.js';

const sessions = new SessionStore();
setInterval(() => sessions.clearExpired(), 10 * 60_000).unref();

function textFromMessage(message) {
  const content = message.message;
  return content.conversation ?? content.extendedTextMessage?.text ?? content.imageMessage?.caption ?? '';
}

function total(cart) { return cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0); }

async function showWelcome(store, send) {
  const categories = await getCategories(store.id);
  await send(welcomeMessage(store, categories));
}

async function createFinalOrder(store, jid, session, fulfillment) {
  const order = await insertOrder({
    store_id: store.id,
    customer_phone: normalizePhone(jid),
    customer_name: session.checkout.name ?? null,
    delivery_address: session.checkout.address ?? null,
    fulfillment_type: fulfillment,
    items: session.cart,
    total_amount: total(session.cart),
    currency: session.cart[0]?.currency ?? store.currency ?? 'ل.س',
    status: 'pending'
  });
  return order;
}

export async function handleInboundMessage({ store, message, send }) {
  const jid = message.key.remoteJid;
  const incoming = normalizeText(textFromMessage(message));
  if (!incoming) return;
  const sessionKey = `${store.id}:${normalizePhone(jid)}`;
  const session = sessions.get(sessionKey);
  const number = parseMenuNumber(incoming);

  if (/^(مرحبا|مرحباً|اهلا|أهلا|ابدأ|start|menu)$/i.test(incoming) || incoming === '0') {
    sessions.create(sessionKey);
    await showWelcome(store, send);
    return;
  }

  if (session.state === 'WELCOME' || session.state === 'CATEGORY') {
    if (number === 4) {
      session.state = 'CART';
      await send(cartMessage(session.cart));
      return;
    }
    if (number === 5) {
      if (!session.cart.length) { await send(prompts.emptyCart); return; }
      session.state = 'CHECKOUT';
      await send(checkoutMessage(session.cart));
      return;
    }
    const category = number ? await getCategoryByNumber(store.id, number) : null;
    if (!category) { await send(prompts.invalid); return; }
    session.category = category;
    session.state = 'PRODUCTS';
    await send(categoryMessage(category, await getProducts(store.id, category.id)));
    return;
  }

  if (session.state === 'PRODUCTS') {
    if (number === 4) { session.state = 'CART'; await send(cartMessage(session.cart)); return; }
    if (number === 5) { session.state = 'CATEGORY'; await showWelcome(store, send); return; }
    const parsed = parseCartItem(incoming);
    if (!parsed) { await send('صيغة غير صحيحة. استخدم رقم المنتج*الكمية، مثل 10*2.'); return; }
    const product = await getProductByNumber(store.id, session.category.id, parsed.productNumber);
    if (!product) { await send('رقم المنتج غير موجود في هذا القسم.'); return; }
    if (session.cart.length >= env.MAX_CART_ITEMS && !session.cart.some((i) => i.product_id === product.id)) {
      await send('تم الوصول للحد الأقصى من أصناف السلة.'); return;
    }
    const existing = session.cart.find((i) => i.product_id === product.id);
    if (existing) existing.quantity = Math.min(99, existing.quantity + parsed.quantity);
    else session.cart.push({ product_id: product.id, name: product.name, price: product.price, currency: product.currency ?? store.currency ?? 'ل.س', quantity: parsed.quantity });
    await send(`تمت إضافة ${product.name} × ${parsed.quantity} إلى السلة.\\n\\n${cartMessage(session.cart)}`);
    return;
  }

  if (session.state === 'CART') {
    if (number === 5) {
      if (!session.cart.length) { await send(prompts.emptyCart); return; }
      session.state = 'CHECKOUT'; await send(checkoutMessage(session.cart)); return;
    }
    if (number === 6) { session.state = 'CATEGORY'; await showWelcome(store, send); return; }
    await send(cartMessage(session.cart));
    return;
  }

  if (session.state === 'CHECKOUT') {
    if (number === 9) { sessions.reset(sessionKey); await send(prompts.cancelled); return; }
    if (number === 7) {
      session.state = 'DELIVERY_NAME';
      await send(prompts.deliveryName);
      return;
    }
    if (number === 8) {
      session.checkout.name = normalizePhone(jid);
      const order = await createFinalOrder(store, jid, session, 'pickup');
      sessions.reset(sessionKey);
      await send(prompts.orderCreated(order));
      return;
    }
    await send(checkoutMessage(session.cart));
    return;
  }

  if (session.state === 'DELIVERY_NAME') {
    session.checkout.name = incoming;
    session.state = 'DELIVERY_ADDRESS';
    await send(prompts.deliveryAddress);
    return;
  }

  if (session.state === 'DELIVERY_ADDRESS') {
    session.checkout.address = incoming;
    const order = await createFinalOrder(store, jid, session, 'delivery');
    sessions.reset(sessionKey);
    await send(prompts.orderCreated(order));
    return;
  }

  logger.warn({ storeId: store.id, jid }, 'Unknown session state');
  sessions.reset(sessionKey);
  await showWelcome(store, send);
}
