import { queryAll, queryOne, execute } from '../../db/index.js';

export function getStorefrontMenu(tenantId, locationId) {
  const location = queryOne(
    'SELECT id, name, timezone, address, phone, pickup_instructions, opening_hours_json, is_paused, pause_reason, lead_time_mins, tax_rate_bps FROM locations WHERE id = ? AND tenant_id = ?',
    [locationId, tenantId]
  );
  if (!location) return null;

  const categories = queryAll(
    'SELECT id, name, sort_order FROM menu_categories WHERE tenant_id = ? AND location_id = ? AND active = 1 ORDER BY sort_order ASC, name ASC',
    [tenantId, locationId]
  );

  const items = queryAll(
    'SELECT id, category_id, name, description, price_minor, image_url, is_available, dietary_tags_json, sort_order FROM menu_items WHERE tenant_id = ? AND location_id = ? ORDER BY sort_order ASC, name ASC',
    [tenantId, locationId]
  );

  const modifierGroups = queryAll(
    'SELECT id, item_id, name, min_selection, max_selection, is_required FROM modifier_groups WHERE tenant_id = ?',
    [tenantId]
  );

  const modifierOptions = queryAll(
    'SELECT id, group_id, name, price_delta_minor, is_available FROM modifier_options WHERE tenant_id = ?',
    [tenantId]
  );

  // Group options by group_id
  const optionsByGroup = {};
  for (const opt of modifierOptions) {
    if (!optionsByGroup[opt.group_id]) optionsByGroup[opt.group_id] = [];
    optionsByGroup[opt.group_id].push(opt);
  }

  // Attach options to modifier groups
  const groupsByItem = {};
  for (const grp of modifierGroups) {
    grp.options = optionsByGroup[grp.id] || [];
    if (!groupsByItem[grp.item_id]) groupsByItem[grp.item_id] = [];
    groupsByItem[grp.item_id].push(grp);
  }

  // Attach modifier groups & parse dietary tags for items
  const itemsByCategory = {};
  for (const it of items) {
    try {
      it.dietary_tags = JSON.parse(it.dietary_tags_json || '[]');
    } catch {
      it.dietary_tags = [];
    }
    it.modifier_groups = groupsByItem[it.id] || [];

    if (!itemsByCategory[it.category_id]) itemsByCategory[it.category_id] = [];
    itemsByCategory[it.category_id].push(it);
  }

  for (const cat of categories) {
    cat.items = itemsByCategory[cat.id] || [];
  }

  let openingHours = {};
  try {
    openingHours = JSON.parse(location.opening_hours_json || '{}');
  } catch {
    openingHours = {};
  }

  return {
    location: {
      ...location,
      opening_hours: openingHours,
      is_paused: Boolean(location.is_paused)
    },
    categories
  };
}

export function setItemAvailability(tenantId, itemId, isAvailable) {
  const item = queryOne('SELECT id, name FROM menu_items WHERE id = ? AND tenant_id = ?', [itemId, tenantId]);
  if (!item) return null;

  execute('UPDATE menu_items SET is_available = ? WHERE id = ? AND tenant_id = ?', [isAvailable ? 1 : 0, itemId, tenantId]);
  return { id: item.id, name: item.name, is_available: Boolean(isAvailable) };
}
