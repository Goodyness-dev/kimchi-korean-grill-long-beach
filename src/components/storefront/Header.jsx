import React from 'react';
import { formatCents } from '../../utils/currency.js';

export default function Header({
  location,
  cartCount,
  cartTotal,
  onOpenCart,
  onOpenStaff,
  onOpenTracking,
  onResetDemo
}) {
  return (
    <header className="sticky top-0 z-30 bg-neutral-950/95 backdrop-blur-md border-b-2 border-neutral-900">
      {/* Top emergency / pause banner if paused */}
      {location?.is_paused && (
        <div className="bg-red-950 border-b border-red-800 text-red-200 px-4 py-2 text-center text-sm font-semibold flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          Ordering is currently paused: {location.pause_reason || 'Kitchen at maximum capacity'}
        </div>
      )}

      {/* Main navigation bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Restaurant Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-serif font-bold text-xl shadow-lg shadow-orange-500/20">
            B
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-lg sm:text-xl font-bold tracking-tight text-white">
                {location?.name || 'Kimchi Korean Grill'}
              </h1>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                Direct Pickup
              </span>
            </div>
            <p className="text-xs text-neutral-400 hidden sm:block">
              {location?.address} Â· {location?.phone}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Track order modal trigger */}
          <button
            onClick={onOpenTracking}
            className="px-3 py-2 text-xs sm:text-sm font-medium text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition"
            title="Track an existing order with your reference number"
          >
            Track Order
          </button>

          {/* Kitchen Staff Portal switch */}
          <button
            onClick={onOpenStaff}
            className="px-3 py-2 text-xs sm:text-sm font-medium text-orange-400 hover:text-orange-300 bg-orange-950/40 hover:bg-orange-950/70 border border-orange-900/60 rounded-xl transition flex items-center gap-1.5"
          >
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            Staff Portal
          </button>

          {/* Sticky Cart Trigger */}
          <button
            onClick={onOpenCart}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-xl shadow-lg shadow-orange-600/30 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span>Cart</span>
            {cartCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-white text-orange-600 font-bold text-xs">
                {cartCount}
              </span>
            )}
            {cartTotal > 0 && (
              <span className="hidden md:inline font-mono text-orange-100">
                ({formatCents(cartTotal)})
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
