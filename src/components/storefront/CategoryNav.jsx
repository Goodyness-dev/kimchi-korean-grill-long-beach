import React from 'react';

export default function CategoryNav({ categories, selectedCategoryId, onSelectCategory }) {
  if (!categories || categories.length === 0) return null;

  return (
    <div className="sticky top-[65px] z-20 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-900 py-3">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => onSelectCategory(null)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 ${
              selectedCategoryId === null
                ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                : 'bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 border border-neutral-800'
            }`}
          >
            All Menu
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 ${
                selectedCategoryId === cat.id
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                  : 'bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 border border-neutral-800'
              }`}
            >
              {cat.name} ({cat.items?.length || 0})
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
