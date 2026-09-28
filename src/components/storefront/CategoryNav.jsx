import React from 'react';
const names = ['BBQ & bowls', 'Fried chicken', 'Stews & rice', 'Sides & snacks', 'Drinks'];
export default function CategoryNav({ categories, selectedCategoryId, onSelectCategory }) {
  if (!categories.length) return null;
  return <nav className="category-nav" aria-label="Menu categories"><div className="category-inner">{[{ id: null, name: 'Everything' }, ...categories].map((cat, index) => <button key={cat.id || 'all'} aria-pressed={selectedCategoryId === cat.id} onClick={() => onSelectCategory(cat.id)}>{index === 0 ? cat.name : names[index - 1] || cat.name}<span>{index === 0 ? categories.reduce((sum, c) => sum + c.items.length, 0) : cat.items?.length}</span></button>)}</div></nav>;
}
