// Resilient Client-Side Fallback Engine for Live Vercel Demos
// Ensures the demo continues functioning seamlessly on static CDN hosting.

const mockLocation = {
  id: 'loc-kimchi-lb',
  name: 'Kimchi Korean Grill - Long Beach',
  timezone: 'America/Los_Angeles',
  address: '1830 E 4th St, Long Beach, CA 90802',
  phone: '(562) 555-1033',
  pickup_instructions: 'Enter through the pickup counter on E 4th St. State your order name or show order reference # to staff.',
  is_paused: false,
  lead_time_mins: 25,
  tax_rate_bps: 1025
};

const mockCategories = [
  {
    id: 'cat-bbq-bowls',
    name: 'Sizzling BBQ Bowls & Plates',
    items: [
      {
        id: 'item-bulgogi',
        category_id: 'cat-bbq-bowls',
        name: 'Bulgogi Prime Beef Plate',
        description: 'Thinly sliced USDA Prime ribeye marinated in artisanal pear-soy reduction, glass noodles, seasoned spinach, roasted sesame, served over your choice of rice.',
        price_minor: 1950,
        image_url: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80',
        is_available: 1,
        dietary_tags: ['Chef Signature', 'Prime Beef'],
        modifier_groups: [
          {
            id: 'grp-rice-b',
            name: 'Choose Rice Base',
            is_required: 1,
            max_selection: 1,
            options: [
              { id: 'opt-rp', name: 'Steamed Purple Multigrain Rice (Heukmi)', price_delta_minor: 0 },
              { id: 'opt-rw', name: 'Steamed Jasmine White Rice', price_delta_minor: 0 },
              { id: 'opt-rc', name: 'Low-Carb Cauliflower Rice Upgrade', price_delta_minor: 250 }
            ]
          },
          {
            id: 'grp-sp-b',
            name: 'Select Spice Level',
            is_required: 1,
            max_selection: 1,
            options: [
              { id: 'opt-s1', name: 'Mild / 순한맛 (Subtle Sweet Soy)', price_delta_minor: 0 },
              { id: 'opt-s2', name: 'Medium / 보통맛 (Balanced Chili Kick)', price_delta_minor: 0 },
              { id: 'opt-s3', name: 'Spicy / 매운맛 (Authentic Gochujang Heat)', price_delta_minor: 0 },
              { id: 'opt-s4', name: 'K-Fire Extreme / 아주 매운맛', price_delta_minor: 100 }
            ]
          },
          {
            id: 'grp-sides-b',
            name: 'Add Extras & Banchan',
            is_required: 0,
            max_selection: 3,
            options: [
              { id: 'opt-e1', name: 'Crispy Sunny-Side Fried Egg', price_delta_minor: 150 },
              { id: 'opt-e2', name: 'Extra House Napa Kimchi Cup', price_delta_minor: 200 },
              { id: 'opt-e3', name: 'Pickled Yellow Radish (Danmuji)', price_delta_minor: 150 }
            ]
          }
        ]
      },
      {
        id: 'item-jeyuk',
        category_id: 'cat-bbq-bowls',
        name: 'Spicy Gochujang Pork (Jeyuk)',
        description: 'Charbroiled pork collar glazed with fermented red pepper paste, caramelized scallions, charred garlic cloves, and toasted sesame.',
        price_minor: 1800,
        image_url: 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?auto=format&fit=crop&w=800&q=80',
        is_available: 1,
        dietary_tags: ['Popular', 'Spicy'],
        modifier_groups: []
      },
      {
        id: 'item-kalbi',
        category_id: 'cat-bbq-bowls',
        name: 'Flame-Grilled Kalbi Short Ribs',
        description: 'Tender bone-in flanken cut beef short ribs grilled over high flame with our 72-hour garlic and Korean pear marinade.',
        price_minor: 2450,
        image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
        is_available: 1,
        dietary_tags: ['House Favorite', 'Prime Beef'],
        modifier_groups: []
      }
    ]
  },
  {
    id: 'cat-kfc',
    name: 'Crispy Korean Fried Chicken',
    items: [
      {
        id: 'item-kfc-y',
        category_id: 'cat-kfc',
        name: 'Sweet & Spicy Yangnyeom KFC (6 pcs)',
        description: 'Double-fried ultra-crispy boneless chicken thighs tossed in sweet & spicy sticky garlic glaze, crushed peanuts, pickled daikon.',
        price_minor: 1650,
        image_url: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80',
        is_available: 1,
        dietary_tags: ['Crispy', 'Signature Glaze'],
        modifier_groups: []
      },
      {
        id: 'item-kfc-g',
        category_id: 'cat-kfc',
        name: 'Honey Soy Garlic KFC (6 pcs)',
        description: 'Golden crunchy double-fried chicken coated in honeyed garlic soy reduction and toasted sesame seeds.',
        price_minor: 1650,
        image_url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80',
        is_available: 1,
        dietary_tags: ['Savory', 'Kid Friendly'],
        modifier_groups: []
      }
    ]
  },
  {
    id: 'cat-stews',
    name: 'Traditional Stews & Dolsot Rice',
    items: [
      {
        id: 'item-bibimbap',
        category_id: 'cat-stews',
        name: 'Sizzling Dolsot Bibimbap',
        description: 'Crispy scorched rice topped with assorted seasoned namul veggies, shiitake, raw egg yolk, and house gochujang paste.',
        price_minor: 1750,
        image_url: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=800&q=80',
        is_available: 1,
        dietary_tags: ['Vegetarian Option', 'Hot Stone'],
        modifier_groups: []
      },
      {
        id: 'item-kimchi-jjigae',
        category_id: 'cat-stews',
        name: 'Aged Kimchi Jjigae with Pork Belly',
        description: 'Rich bubbling stew made with 3-year aged house kimchi, tender pork belly, silken tofu, and scallions in kelp anchovy broth.',
        price_minor: 1650,
        image_url: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=800&q=80',
        is_available: 1,
        dietary_tags: ['Comfort Stew', 'Spicy'],
        modifier_groups: []
      }
    ]
  },
  {
    id: 'cat-street',
    name: 'Banchan & Street Snacks',
    items: [
      {
        id: 'item-pajeon',
        category_id: 'cat-street',
        name: 'Crispy Seafood Scallion Pajeon',
        description: 'Crispy pan-fried pancake loaded with local calamari, bay shrimp, whole scallions, served with spicy sesame soy dip.',
        price_minor: 1500,
        image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
        is_available: 1,
        dietary_tags: ['Sharable Snack'],
        modifier_groups: []
      },
      {
        id: 'item-tteokbokki',
        category_id: 'cat-street',
        name: 'Street Tteokbokki & Fish Cakes',
        description: 'Chewy rice cakes, Busan fish cakes, scallions, rich gochujang broth, topped with a hard-boiled egg.',
        price_minor: 1250,
        image_url: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80',
        is_available: 1,
        dietary_tags: ['K-Street Food', 'Spicy'],
        modifier_groups: []
      }
    ]
  },
  {
    id: 'cat-drinks',
    name: 'Korean Drinks & Refreshers',
    items: [
      {
        id: 'item-milkis',
        category_id: 'cat-drinks',
        name: 'Korean Milkis Yogurt Soda (250ml)',
        description: 'Refreshing sweet and bubbly carbonated milk & yogurt drink.',
        price_minor: 350,
        image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80',
        is_available: 1,
        dietary_tags: ['Chilled Can'],
        modifier_groups: []
      },
      {
        id: 'item-bongbong',
        category_id: 'cat-drinks',
        name: 'Bong Bong Grape Juice with Pulp',
        description: 'Classic Korean sweet white grape drink with whole peeled grapes inside.',
        price_minor: 350,
        image_url: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=800&q=80',
        is_available: 1,
        dietary_tags: ['Chilled Can'],
        modifier_groups: []
      }
    ]
  }
];

export function getFallbackMenu() {
  return {
    location: mockLocation,
    categories: mockCategories
  };
}

export function computeFallbackQuote(items) {
  let subtotal = 0;
  for (const it of items) {
    subtotal += (it.unitPriceMinor || it.basePriceMinor || 1500) * (it.quantity || 1);
  }
  const tax = Math.round((subtotal * 1025) / 10000);
  const total = subtotal + tax;
  return {
    tenantId: 'tenant-kimchi',
    locationId: 'loc-kimchi-lb',
    currency: 'USD',
    taxRateBps: 1025,
    subtotalMinor: subtotal,
    taxMinor: tax,
    totalMinor: total,
    quoteToken: 'mock-token-' + Date.now(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
  };
}