import React from 'react';
import { formatCents } from '../../utils/currency.js';

export default function MenuGrid({ categories, selectedCategoryId, onItemClick }) {
  const filteredCategories = selectedCategoryId
    ? categories.filter(c => c.id === selectedCategoryId)
    : categories;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {filteredCategories.map(category => (
        <section key={category.id} className="space-y-4">
          <div className="flex items-center gap-3 border-b border-neutral-900 pb-3">
            <h3 className="font-serif text-2xl font-bold text-white tracking-tight">
              {category.name}
            </h3>
            <span className="text-xs text-neutral-400 font-mono">
              ({category.items?.length || 0} items)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {category.items?.map(item => {
              const isAvailable = Boolean(item.is_available);
              return (
                <div
                  key={item.id}
                  onClick={() => isAvailable && onItemClick(item)}
                  className={`card-thick p-5 flex flex-col justify-between group relative overflow-hidden ${
                    isAvailable
                      ? 'cursor-pointer hover:border-neutral-700 hover:shadow-2xl hover:shadow-orange-500/10'
                      : 'opacity-60 cursor-not-allowed bg-neutral-950/80 border-neutral-900'
                  }`}
                >
                  {/* Top image if present */}
                  {item.image_url && (
                    <div className="relative h-44 -mx-5 -mt-5 mb-4 overflow-hidden rounded-t-xl bg-neutral-900">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className={`w-full h-full object-cover transition duration-300 ${
                          isAvailable ? 'group-hover:scale-105' : 'grayscale'
                        }`}
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-transparent to-transparent"></div>
                      {!isAvailable && (
                        <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                          <span className="px-3 py-1 bg-red-950 border border-red-800 text-red-300 font-bold text-xs uppercase tracking-wider rounded-lg">
                            Sold Out Today (86)
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-serif text-lg font-bold text-white group-hover:text-orange-400 transition">
                        {item.name}
                      </h4>
                      <span className="font-mono text-base font-bold text-orange-400 shrink-0">
                        {formatCents(item.price_minor)}
                      </span>
                    </div>

                    {/* Dietary / Specialty tags */}
                    {item.dietary_tags && item.dietary_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {item.dietary_tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-neutral-800/80 text-neutral-300 border border-neutral-700/60"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-800/60 flex items-center justify-between text-xs">
                    {item.modifier_groups && item.modifier_groups.length > 0 ? (
                      <span className="text-neutral-400 flex items-center gap-1 font-medium">
                        <svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                        Options available
                      </span>
                    ) : (
                      <span className="text-neutral-500 font-medium">Standard preparation</span>
                    )}

                    {isAvailable ? (
                      <span className="text-orange-400 font-semibold group-hover:translate-x-0.5 transition flex items-center gap-1">
                        Select
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    ) : (
                      <span className="text-red-400/80 font-medium">Unavailable</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
