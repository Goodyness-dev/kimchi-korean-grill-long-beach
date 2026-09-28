import React, { useEffect, useRef } from 'react';
import { formatCents } from '../../utils/currency.js';
export default function MenuGrid({ categories, selectedCategoryId, onItemClick }) {
  const root = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('revealed'); observer.unobserve(entry.target); } }), { threshold: .08 });
    root.current?.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [categories, selectedCategoryId]);
  return <div className="menu-content" ref={root}>{categories.filter(cat => !selectedCategoryId || cat.id === selectedCategoryId).map(category => <section key={category.id} className="menu-section"><div className="category-heading"><span className="eyebrow">0{categories.indexOf(category) + 1}</span><h3>{category.name}</h3></div><div className="dish-grid">{category.items?.map((item, index) => <button key={item.id} className="dish-card reveal" style={{ '--delay': `${index % 3 * 65}ms` }} disabled={!item.is_available} onClick={() => onItemClick(item)}><div className="dish-image">{item.image_url && <img src={item.image_url} alt={item.name} loading="lazy"/>}<span className="dish-add" aria-hidden="true">{item.is_available ? '↗' : '—'}</span>{!item.is_available && <span className="sold-out">Sold out</span>}</div><div className="dish-title"><h4>{item.name}</h4><span>{formatCents(item.price_minor)}</span></div><p>{item.description}</p><div className="dish-tags">{item.dietary_tags?.join(' / ')}</div></button>)}</div></section>)}</div>;
}
