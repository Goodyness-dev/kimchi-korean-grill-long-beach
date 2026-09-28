import React, { useEffect, useState } from 'react';
import { formatCents } from '../../utils/currency.js';

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCheckout,
  location
}) {
  const [quote, setQuote] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState(null);

  // Authoritative server-side quote recalculation on cart change
  useEffect(() => {
    if (!isOpen || cartItems.length === 0) {
      setQuote(null);
      return;
    }

    let isMounted = true;
    setLoadingQuote(true);
    setQuoteError(null);

    fetch('/v1/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant-kimchi',
        locationId: location?.id || 'loc-kimchi-lb',
        items: cartItems.map(it => ({
          itemId: it.itemId,
          quantity: it.quantity,
          selectedOptionIds: it.selectedOptionIds,
          customerNotes: it.customerNotes
        }))
      })
    })
      .then(res => {
        if (!res.ok) return res.json().then(e => Promise.reject(e));
        return res.json();
      })
      .then(data => {
        if (isMounted) {
          setQuote(data);
          setLoadingQuote(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setQuoteError(err.message || 'Failed to calculate quote');
          setLoadingQuote(false);
        }
      });

    return () => { isMounted = false; };
  }, [isOpen, cartItems, location]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-neutral-950 border-l-2 border-neutral-800 shadow-2xl flex flex-col">
          {/* Drawer Header */}
          <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-950/80 border border-orange-800 text-orange-400 flex items-center justify-center font-bold">
                ðŸ›’
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-white">Your Pickup Cart</h3>
                <p className="text-xs text-neutral-400">{cartItems.length} distinct item(s)</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Drawer Body - Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {cartItems.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <div className="text-4xl">ðŸ•</div>
                <h4 className="font-serif text-base font-bold text-neutral-300">Your basket is empty</h4>
                <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                  Add fresh wood-fired Prime Bulgogi, spicy pork, crispy chicken, or dolsot bibimbap from our menu.
                </p>
                <button
                  onClick={onClose}
                  className="mt-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-orange-400 text-xs font-semibold rounded-xl border border-neutral-800 transition"
                >
                  Browse Menu
                </button>
              </div>
            ) : (
              cartItems.map((item, index) => (
                <div key={index} className="card-thick p-4 space-y-2 relative group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-serif font-bold text-sm text-white">
                        {item.name}
                      </div>
                      <div className="font-mono text-xs text-orange-400 font-semibold">
                        {formatCents(item.unitPriceMinor)} each
                      </div>
                    </div>

                    <div className="font-mono font-bold text-sm text-white">
                      {formatCents(item.unitPriceMinor * item.quantity)}
                    </div>
                  </div>

                  {item.customerNotes && (
                    <div className="text-[11px] text-neutral-400 italic bg-neutral-900/60 p-2 rounded-lg border border-neutral-800/80">
                      Note: &quot;{item.customerNotes}&quot;
                    </div>
                  )}

                  {/* Quantity and Remove controls */}
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60 text-xs">
                    <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
                      <button
                        onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                        className="w-6 h-6 rounded bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center font-bold"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-white px-2">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                        className="w-6 h-6 rounded bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center font-bold"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => onRemoveItem(index)}
                      className="text-neutral-500 hover:text-red-400 text-[11px] font-medium transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}

            {quoteError && (
              <div className="p-3 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-xl flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>{quoteError}</span>
              </div>
            )}
          </div>

          {/* Drawer Footer - Server Quote Totals */}
          {cartItems.length > 0 && (
            <div className="p-5 border-t border-neutral-800 bg-neutral-900/80 space-y-3">
              <div className="space-y-1.5 text-xs text-neutral-300">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono font-semibold text-white">
                    {loadingQuote ? 'Calculating...' : formatCents(quote?.subtotalMinor || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Tax (10.25%)</span>
                  <span className="font-mono font-semibold text-white">
                    {loadingQuote ? 'Calculating...' : formatCents(quote?.taxMinor || 0)}
                  </span>
                </div>
                <div className="pt-2 border-t border-neutral-800 flex justify-between text-sm font-bold text-white">
                  <span>Total at Pickup</span>
                  <span className="font-mono text-base text-orange-400">
                    {loadingQuote ? '...' : formatCents(quote?.totalMinor || 0)}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-neutral-400 bg-neutral-950 p-2.5 rounded-xl border border-neutral-800 flex items-center gap-2">
                <span className="text-emerald-400 text-sm">âœ“</span>
                <span>Pay in person at pickup counter. No card payment online.</span>
              </div>

              <button
                type="button"
                disabled={loadingQuote || !quote || Boolean(quoteError)}
                onClick={() => onProceedToCheckout(quote)}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-600/30 transition flex items-center justify-center gap-2"
              >
                <span>Proceed to Pickup Details</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
