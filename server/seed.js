import crypto from 'node:crypto';
import { execute, withTransaction } from './db/index.js';
import { hashPassword } from './modules/identity/auth.js';

console.log('[Seed] Seeding Kimchi Korean Grill Long Beach restaurant data...');

withTransaction(() => {
  // Clean existing data
  execute(`DELETE FROM notification_attempts`);
  execute(`DELETE FROM outbox_jobs`);
  execute(`DELETE FROM idempotency_records`);
  execute(`DELETE FROM order_events`);
  execute(`DELETE FROM order_items`);
  execute(`DELETE FROM orders`);
  execute(`DELETE FROM modifier_options`);
  execute(`DELETE FROM modifier_groups`);
  execute(`DELETE FROM menu_items`);
  execute(`DELETE FROM menu_categories`);
  execute(`DELETE FROM staff_memberships`);
  execute(`DELETE FROM locations`);
  execute(`DELETE FROM tenants`);

  // 1. Tenant
  const tenantId = 'tenant-kimchi';
  execute(`
    INSERT INTO tenants (id, name, status, currency)
    VALUES (?, 'Kimchi Korean Grill', 'ACTIVE', 'USD')
  `, [tenantId]);

  // 2. Location (Long Beach, CA)
  const locationId = 'loc-kimchi-lb';
  const hours = {
    monday: { open: '11:30', close: '21:30', isOpen: true },
    tuesday: { open: '11:30', close: '21:30', isOpen: true },
    wednesday: { open: '11:30', close: '21:30', isOpen: true },
    thursday: { open: '11:30', close: '21:30', isOpen: true },
    friday: { open: '11:30', close: '22:30', isOpen: true },
    saturday: { open: '11:30', close: '22:30', isOpen: true },
    sunday: { open: '12:00', close: '21:00', isOpen: true }
  };

  execute(`
    INSERT INTO locations (
      id, tenant_id, name, timezone, address, phone, pickup_instructions,
      opening_hours_json, is_paused, lead_time_mins, max_concurrent_orders,
      tax_rate_bps, acceptance_window_mins
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 25, 35, 1025, 15)
  `, [
    locationId, tenantId, 'Kimchi Korean Grill - Long Beach', 'America/Los_Angeles',
    '1830 E 4th St, Long Beach, CA 90802', '(562) 555-1033',
    'Enter through the pickup counter on E 4th St. State your order name or show order reference # to staff.',
    JSON.stringify(hours)
  ]);

  // 3. Staff Memberships (password: admin2026)
  const defaultPwHash = hashPassword('admin2026');
  execute(`
    INSERT INTO staff_memberships (id, tenant_id, username, password_hash, role, active)
    VALUES
      ('staff-owner', ?, 'owner@kimchigrill.com', ?, 'OWNER', 1),
      ('staff-manager', ?, 'manager@kimchigrill.com', ?, 'MANAGER', 1),
      ('staff-kitchen', ?, 'kitchen@kimchigrill.com', ?, 'KITCHEN', 1)
  `, [tenantId, defaultPwHash, tenantId, defaultPwHash, tenantId, defaultPwHash]);

  // 4. Menu Categories
  const catBbq = 'cat-bbq-bowls';
  const catKfc = 'cat-kfc';
  const catStews = 'cat-stews';
  const catStreet = 'cat-street';
  const catDrinks = 'cat-drinks';

  execute(`
    INSERT INTO menu_categories (id, tenant_id, location_id, name, sort_order, active)
    VALUES
      (?, ?, ?, 'Sizzling BBQ Bowls & Plates', 1, 1),
      (?, ?, ?, 'Crispy Korean Fried Chicken', 2, 1),
      (?, ?, ?, 'Traditional Stews & Dolsot Rice', 3, 1),
      (?, ?, ?, 'Banchan & Street Snacks', 4, 1),
      (?, ?, ?, 'Korean Drinks & Refreshers', 5, 1)
  `, [catBbq, tenantId, locationId, catKfc, tenantId, locationId, catStews, tenantId, locationId, catStreet, tenantId, locationId, catDrinks, tenantId, locationId]);

  // 5. Menu Items
  // Item 1: Bulgogi Prime Beef
  const itemBulgogi = 'item-bulgogi';
  execute(`
    INSERT INTO menu_items (id, tenant_id, location_id, category_id, name, description, price_minor, image_url, is_available, dietary_tags_json, sort_order)
    VALUES (?, ?, ?, ?, 'Bulgogi Prime Beef Plate', 'Thinly sliced USDA Prime ribeye marinated in artisanal pear-soy reduction, glass noodles, seasoned spinach, roasted sesame, served over your choice of rice.', 1950, 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80', 1, '["Chef Signature", "Prime Beef"]', 1)
  `, [itemBulgogi, tenantId, locationId, catBbq]);

  // Item 2: Spicy Gochujang Pork (Jeyuk Bokkeum)
  const itemJeyuk = 'item-jeyuk';
  execute(`
    INSERT INTO menu_items (id, tenant_id, location_id, category_id, name, description, price_minor, image_url, is_available, dietary_tags_json, sort_order)
    VALUES (?, ?, ?, ?, 'Spicy Gochujang Pork (Jeyuk)', 'Charbroiled pork collar glazed with fermented red pepper paste, caramelized scallions, charred garlic cloves, and toasted sesame.', 1800, 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?auto=format&fit=crop&w=800&q=80', 1, '["Popular", "Spicy"]', 2)
  `, [itemJeyuk, tenantId, locationId, catBbq]);

  // Item 3: Flame-Grilled Kalbi Short Ribs
  const itemKalbi = 'item-kalbi';
  execute(`
    INSERT INTO menu_items (id, tenant_id, location_id, category_id, name, description, price_minor, image_url, is_available, dietary_tags_json, sort_order)
    VALUES (?, ?, ?, ?, 'Flame-Grilled Kalbi Short Ribs', 'Tender bone-in flanken cut beef short ribs grilled over high flame with our 72-hour garlic and Korean pear marinade.', 2450, 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80', 1, '["House Favorite", "Prime Beef"]', 3)
  `, [itemKalbi, tenantId, locationId, catBbq]);

  // Item 4: Yangnyeom Korean Fried Chicken
  const itemKfcYangnyeom = 'item-kfc-yangnyeom';
  execute(`
    INSERT INTO menu_items (id, tenant_id, location_id, category_id, name, description, price_minor, image_url, is_available, dietary_tags_json, sort_order)
    VALUES (?, ?, ?, ?, 'Sweet & Spicy Yangnyeom KFC (6 pcs)', 'Double-fried ultra-crispy boneless chicken thighs tossed in sweet & spicy sticky garlic glaze, crushed peanuts, pickled daikon.', 1650, 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80', 1, '["Crispy", "Signature Glaze"]', 1)
  `, [itemKfcYangnyeom, tenantId, locationId, catKfc]);

  // Item 5: Soy Garlic Fried Chicken
  const itemKfcGarlic = 'item-kfc-garlic';
  execute(`
    INSERT INTO menu_items (id, tenant_id, location_id, category_id, name, description, price_minor, image_url, is_available, dietary_tags_json, sort_order)
    VALUES (?, ?, ?, ?, 'Honey Soy Garlic KFC (6 pcs)', 'Golden crunchy double-fried chicken coated in honeyed garlic soy reduction and toasted sesame seeds.', 1650, 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80', 1, '["Savory", "Kid Friendly"]', 2)
  `, [itemKfcGarlic, tenantId, locationId, catKfc]);

  // Item 6: Sizzling Dolsot Bibimbap
  const itemBibimbap = 'item-bibimbap';
  execute(`
    INSERT INTO menu_items (id, tenant_id, location_id, category_id, name, description, price_minor, image_url, is_available, dietary_tags_json, sort_order)
    VALUES (?, ?, ?, ?, 'Sizzling Dolsot Bibimbap', 'Crispy scorched rice topped with assorted seasoned namul veggies, shiitake, raw egg yolk, and house gochujang paste.', 1750, 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=800&q=80', 1, '["Vegetarian Option", "Hot Stone"]', 1)
  `, [itemBibimbap, tenantId, locationId, catStews]);

  // Item 7: Aged Kimchi Jjigae
  const itemKimchiJjigae = 'item-kimchi-jjigae';
  execute(`
    INSERT INTO menu_items (id, tenant_id, location_id, category_id, name, description, price_minor, image_url, is_available, dietary_tags_json, sort_order)
    VALUES (?, ?, ?, ?, 'Aged Kimchi Jjigae with Pork Belly', 'Rich bubbling stew made with 3-year aged house kimchi, tender pork belly, silken tofu, and scallions in kelp anchovy broth.', 1650, 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=800&q=80', 1, '["Comfort Stew", "Spicy"]', 2)
  `, [itemKimchiJjigae, tenantId, locationId, catStews]);

  // Item 8: Sundubu Jjigae
  const itemSundubu = 'item-sundubu';
  execute(`
    INSERT INTO menu_items (id, tenant_id, location_id, category_id, name, description, price_minor, image_url, is_available, dietary_tags_json, sort_order)
    VALUES (?, ?, ?, ?, 'Spicy Soft Tofu Stew (Sundubu)', 'Silken uncurdled tofu, enoki mushrooms, zucchini, spicy chili oil broth, served with farm fresh egg drop.', 1600, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80', 1, '["Gluten-Free Option", "Spicy"]', 3)
  `, [itemSundubu, tenantId, locationId, catStews]);

  // Item 9: Seafood Pajeon
  const itemPajeon = 'item-pajeon';
  execute(`
    INSERT INTO menu_items (id, tenant_id, location_id, category_id, name, description, price_minor, image_url, is_available, dietary_tags_json, sort_order)
    VALUES (?, ?, ?, ?, 'Crispy Seafood Scallion Pajeon', 'Crispy pan-fried pancake loaded with local calamari, bay shrimp, whole scallions, served with spicy sesame soy dip.', 1500, 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80', 1, '["Sharable Snack"]', 1)
  `, [itemPajeon, tenantId, locationId, catStreet]);

  // Item 10: Street Tteokbokki
  const itemTteokbokki = 'item-tteokbokki';
  execute(`
    INSERT INTO menu_items (id, tenant_id, location_id, category_id, name, description, price_minor, image_url, is_available, dietary_tags_json, sort_order)
    VALUES (?, ?, ?, ?, 'Street Tteokbokki & Fish Cakes', 'Chewy rice cakes, Busan fish cakes, scallions, rich gochujang broth, topped with a hard-boiled egg.', 1250, 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80', 1, '["K-Street Food", "Spicy"]', 2)
  `, [itemTteokbokki, tenantId, locationId, catStreet]);

  // Item 11: House Fermented Kimchi Jar
  const itemKimchiJar = 'item-kimchi-jar';
  execute(`
    INSERT INTO menu_items (id, tenant_id, location_id, category_id, name, description, price_minor, image_url, is_available, dietary_tags_json, sort_order)
    VALUES (?, ?, ?, ?, 'House-Fermented Napa Kimchi (8oz)', 'Chef Jun handcrafted artisanal Napa cabbage kimchi, fermented naturally with sea salt, Korean chili powder, and garlic.', 600, 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=800&q=80', 1, '["Vegan", "House Made"]', 3)
  `, [itemKimchiJar, tenantId, locationId, catStreet]);

  // Item 12: Milkis Soda
  const itemMilkis = 'item-milkis';
  execute(`
    INSERT INTO menu_items (id, tenant_id, location_id, category_id, name, description, price_minor, image_url, is_available, dietary_tags_json, sort_order)
    VALUES (?, ?, ?, ?, 'Korean Milkis Yogurt Soda (250ml)', 'Refreshing sweet and bubbly carbonated milk & yogurt drink.', 350, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80', 1, '["Chilled Can"]', 1)
  `, [itemMilkis, tenantId, locationId, catDrinks]);

  // Item 13: Bong Bong Green Grape
  const itemBongBong = 'item-bongbong';
  execute(`
    INSERT INTO menu_items (id, tenant_id, location_id, category_id, name, description, price_minor, image_url, is_available, dietary_tags_json, sort_order)
    VALUES (?, ?, ?, ?, 'Bong Bong Grape Juice with Pulp', 'Classic Korean sweet white grape drink with whole peeled grapes inside.', 350, 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=800&q=80', 1, '["Chilled Can"]', 2)
  `, [itemBongBong, tenantId, locationId, catDrinks]);

  // 6. Modifiers for BBQ Plates (Rice Base & Spice Level)
  const grpRice = 'grp-rice-bulgogi';
  execute(`
    INSERT INTO modifier_groups (id, tenant_id, item_id, name, min_selection, max_selection, is_required)
    VALUES (?, ?, ?, 'Choose Rice Base', 1, 1, 1)
  `, [grpRice, tenantId, itemBulgogi]);

  execute(`
    INSERT INTO modifier_options (id, tenant_id, group_id, name, price_delta_minor, is_available)
    VALUES
      ('opt-rice-purple', ?, ?, 'Steamed Purple Multigrain Rice (Heukmi)', 0, 1),
      ('opt-rice-white', ?, ?, 'Steamed Jasmine White Rice', 0, 1),
      ('opt-rice-cauli', ?, ?, 'Low-Carb Cauliflower Rice Upgrade', 250, 1)
  `, [tenantId, grpRice, tenantId, grpRice, tenantId, grpRice]);

  const grpSpice = 'grp-spice-bulgogi';
  execute(`
    INSERT INTO modifier_groups (id, tenant_id, item_id, name, min_selection, max_selection, is_required)
    VALUES (?, ?, ?, 'Select Spice Level', 1, 1, 1)
  `, [grpSpice, tenantId, itemBulgogi]);

  execute(`
    INSERT INTO modifier_options (id, tenant_id, group_id, name, price_delta_minor, is_available)
    VALUES
      ('opt-sp-mild', ?, ?, 'Mild / 순한맛 (Subtle Sweet Soy)', 0, 1),
      ('opt-sp-med', ?, ?, 'Medium / 보통맛 (Balanced Chili Kick)', 0, 1),
      ('opt-sp-hot', ?, ?, 'Spicy / 매운맛 (Authentic Gochujang Heat)', 0, 1),
      ('opt-sp-fire', ?, ?, 'K-Fire Extreme / 아주 매운맛 (Ghost Pepper Infusion)', 100, 1)
  `, [tenantId, grpSpice, tenantId, grpSpice, tenantId, grpSpice, tenantId, grpSpice]);

  const grpSides = 'grp-sides-bulgogi';
  execute(`
    INSERT INTO modifier_groups (id, tenant_id, item_id, name, min_selection, max_selection, is_required)
    VALUES (?, ?, ?, 'Add Extras & Banchan', 0, 3, 0)
  `, [grpSides, tenantId, itemBulgogi]);

  execute(`
    INSERT INTO modifier_options (id, tenant_id, group_id, name, price_delta_minor, is_available)
    VALUES
      ('opt-side-egg', ?, ?, 'Crispy Sunny-Side Fried Egg', 150, 1),
      ('opt-side-kimchi', ?, ?, 'Extra House Napa Kimchi Cup', 200, 1),
      ('opt-side-radish', ?, ?, 'Pickled Yellow Radish (Danmuji)', 150, 1)
  `, [tenantId, grpSides, tenantId, grpSides, tenantId, grpSides]);

  // Link identical rice & spice to Jeyuk Pork
  const grpRiceJeyuk = 'grp-rice-jeyuk';
  execute(`
    INSERT INTO modifier_groups (id, tenant_id, item_id, name, min_selection, max_selection, is_required)
    VALUES (?, ?, ?, 'Choose Rice Base', 1, 1, 1)
  `, [grpRiceJeyuk, tenantId, itemJeyuk]);

  execute(`
    INSERT INTO modifier_options (id, tenant_id, group_id, name, price_delta_minor, is_available)
    VALUES
      ('opt-jeyuk-p', ?, ?, 'Steamed Purple Multigrain Rice', 0, 1),
      ('opt-jeyuk-w', ?, ?, 'Steamed Jasmine White Rice', 0, 1)
  `, [tenantId, grpRiceJeyuk, tenantId, grpRiceJeyuk]);
});

console.log('[Seed] Seeding completed successfully for Kimchi Korean Grill!');
console.log('[Seed] Restaurant: Kimchi Korean Grill (Long Beach, CA)');
console.log('[Seed] Staff Logins (password: admin2026):');
console.log('       kitchen@kimchigrill.com  / admin2026 (KITCHEN)');
console.log('       manager@kimchigrill.com  / admin2026 (MANAGER)');
console.log('       owner@kimchigrill.com    / admin2026 (OWNER)');