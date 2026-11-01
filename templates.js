import { money } from './helpers.js';

export function welcomeMessage(store, categories) {
  const lines = [`مرحباً بك في ${store.name}!`, '', 'اختر القسم بإرسال رقمه:'];
  categories.forEach((category, index) => lines.push(`[${index + 1}] ${category.name}`));
  lines.push('', '[4] السلة', '[5] إنهاء الطلب');
  return lines.join('\\n');
}

export function categoryMessage(category, products) {
  const lines = [`قسم: ${category.name}`, ''];
  if (!products.length) lines.push('لا توجد منتجات متاحة حالياً.');
  products.forEach((product, index) => {
    lines.push(`[${index + 1}] ${product.name} — ${money(product.price, product.currency ?? 'ر.س')}`);
    if (product.description) lines.push(`    ${product.description}`);
  });
  lines.push('', 'للإضافة إلى السلة أرسل: رقم المنتج*الكمية', 'مثال: 10*2', '', '[4] السلة', '[5] الأقسام الرئيسية');
  return lines.join('\\n');
}

export function cartMessage(cart) {
  if (!cart.length) return 'السلة فارغة حالياً.\\nأرسل [5] للعودة إلى الأقسام.';
  const lines = ['محتويات السلة:', ''];
  let total = 0;
  cart.forEach((item, index) => {
    const lineTotal = Number(item.price) * item.quantity;
    total += lineTotal;
    lines.push(`${index + 1}. ${item.name} × ${item.quantity} = ${money(lineTotal, item.currency)}`);
  });
  lines.push('', `الإجمالي: ${money(total, cart[0].currency ?? 'ر.س')}`, '', 'أرسل [5] لإتمام الطلب أو [6] للعودة للأقسام.');
  return lines.join('\\n');
}

export function checkoutMessage(cart) {
  let total = 0;
  const lines = ['تفاصيل الطلب:', ''];
  cart.forEach((item, index) => {
    const lineTotal = Number(item.price) * item.quantity;
    total += lineTotal;
    lines.push(`${index + 1}. ${item.name} × ${item.quantity} = ${money(lineTotal, item.currency)}`);
  });
  lines.push('', `الإجمالي: ${money(total, cart[0]?.currency ?? 'ر.س')}`, '', '[7] التوصيل', '[8] الاستلام', '[9] إلغاء');
  return lines.join('\\n');
}

export const prompts = {
  deliveryName: 'أرسل الاسم الكامل من فضلك:',
  deliveryAddress: 'أرسل عنوان التوصيل بالتفصيل:',
  invalid: 'الخيار غير معروف. أرسل رقماً من القائمة أو [5] للبدء من جديد.',
  emptyCart: 'السلة فارغة. اختر منتجاً أولاً.',
  orderCreated: (order) => `تم استلام طلبك بنجاح. رقم الطلب: ${order.order_number}\\nالحالة: pending`,
  cancelled: 'تم إلغاء الطلب وإفراغ السلة.'
};
