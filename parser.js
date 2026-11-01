export function parseMenuNumber(text) {
  const match = text.trim().match(/^\\[?(\\d+)\\]?$/);
  return match ? Number(match[1]) : null;
}

export function parseCartItem(text) {
  const match = text.trim().match(/^(\\d+)\\s*[*xX×]\\s*(\\d+)$/);
  if (!match) return null;
  const productNumber = Number(match[1]);
  const quantity = Number(match[2]);
  if (!Number.isInteger(productNumber) || !Number.isInteger(quantity) || productNumber < 1 || quantity < 1 || quantity > 99) return null;
  return { productNumber, quantity };
}
