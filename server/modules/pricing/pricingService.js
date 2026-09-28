import crypto from 'node:crypto';
import { queryOne, queryAll } from '../../db/index.js';

const QUOTE_SECRET = process.env.QUOTE_SECRET || 'restaurant-quote-secret-2026';

export function calculateQuote(tenantId, locationId, items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Basket must contain at least one item');
  }

  const location = queryOne(
    'SELECT l.id, l.is_paused, l.tax_rate_bps, t.currency FROM locations l JOIN tenants t ON l.tenant_id = t.id WHERE l.id = ? AND l.tenant_id = ?',
    [locationId, tenantId]
  );
  if (!location) throw new Error('Location not found');
  if (location.is_paused) throw new Error('Ordering is currently paused at this location');

  let subtotalMinor = 0;
  const validatedLines = [];

  for (const line of items) {
    const { itemId, quantity, selectedOptionIds, customerNotes } = line;
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0 || qty > 50) {
      throw new Error(`Invalid item quantity: ${quantity}`);
    }

    if (customerNotes && customerNotes.length > 250) {
      throw new Error('Item note exceeds 250 characters maximum');
    }

    const menuItem = queryOne(
      'SELECT id, name, price_minor, is_available FROM menu_items WHERE id = ? AND tenant_id = ? AND location_id = ?',
      [itemId, tenantId, locationId]
    );
    if (!menuItem) {
      throw new Error(`Item ${itemId} not found in catalog`);
    }
    if (!menuItem.is_available) {
      throw new Error(`"${menuItem.name}" is currently sold out / unavailable`);
    }

    // Fetch modifier groups for this item
    const modGroups = queryAll(
      'SELECT id, name, min_selection, max_selection, is_required FROM modifier_groups WHERE item_id = ? AND tenant_id = ?',
      [itemId, tenantId]
    );

    // Validate selected options
    const optionIds = Array.isArray(selectedOptionIds) ? selectedOptionIds : [];
    const chosenOptionsSnapshot = [];
    let lineOptionDeltaTotal = 0;

    for (const group of modGroups) {
      const groupOptions = queryAll(
        'SELECT id, name, price_delta_minor, is_available FROM modifier_options WHERE group_id = ? AND tenant_id = ?',
        [group.id, tenantId]
      );
      const groupOptionMap = new Map(groupOptions.map(o => [o.id, o]));

      const selectedInThisGroup = optionIds.filter(id => groupOptionMap.has(id));

      if (group.is_required && selectedInThisGroup.length < (group.min_selection || 1)) {
        throw new Error(`Required selection missing for modifier group "${group.name}"`);
      }
      if (selectedInThisGroup.length > group.max_selection) {
        throw new Error(`Too many selections in "${group.name}" (max allowed: ${group.max_selection})`);
      }

      for (const optId of selectedInThisGroup) {
        const opt = groupOptionMap.get(optId);
        if (!opt.is_available) {
          throw new Error(`Modifier option "${opt.name}" is currently unavailable`);
        }
        lineOptionDeltaTotal += opt.price_delta_minor;
        chosenOptionsSnapshot.push({
          groupId: group.id,
          groupName: group.name,
          optionId: opt.id,
          name: opt.name,
          priceDeltaMinor: opt.price_delta_minor
        });
      }
    }

    const unitPriceMinor = menuItem.price_minor + lineOptionDeltaTotal;
    const lineTotalMinor = unitPriceMinor * qty;
    subtotalMinor += lineTotalMinor;

    validatedLines.push({
      itemId: menuItem.id,
      name: menuItem.name,
      basePriceMinor: menuItem.price_minor,
      unitPriceMinor,
      quantity: qty,
      lineTotalMinor,
      selectedOptions: chosenOptionsSnapshot,
      customerNotes: customerNotes ? customerNotes.trim() : ''
    });
  }

  // Consistent documented rounding: integer basis points
  // tax = Math.round((subtotal * tax_rate_bps) / 10000)
  const taxRateBps = location.tax_rate_bps || 825;
  const taxMinor = Math.round((subtotalMinor * taxRateBps) / 10000);
  const totalMinor = subtotalMinor + taxMinor;

  // Generate quote signature valid for 10 minutes
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const quoteDigest = crypto
    .createHmac('sha256', QUOTE_SECRET)
    .update(`${tenantId}:${locationId}:${subtotalMinor}:${taxMinor}:${totalMinor}:${expiresAt}`)
    .digest('hex');

  return {
    tenantId,
    locationId,
    currency: location.currency || 'USD',
    taxRateBps,
    subtotalMinor,
    taxMinor,
    totalMinor,
    items: validatedLines,
    quoteToken: `${quoteDigest}.${Buffer.from(expiresAt).toString('base64url')}`,
    expiresAt
  };
}

export function verifyQuoteToken(tenantId, locationId, subtotalMinor, taxMinor, totalMinor, quoteToken) {
  if (!quoteToken) return false;
  try {
    const [signature, expiresAtB64] = quoteToken.split('.');
    if (!signature || !expiresAtB64) return false;
    const expiresAt = Buffer.from(expiresAtB64, 'base64url').toString('utf8');
    if (new Date(expiresAt).getTime() < Date.now()) {
      return false; // Expired quote
    }

    const expectedSig = crypto
      .createHmac('sha256', QUOTE_SECRET)
      .update(`${tenantId}:${locationId}:${subtotalMinor}:${taxMinor}:${totalMinor}:${expiresAt}`)
      .digest('hex');

    return signature === expectedSig;
  } catch {
    return false;
  }
}
