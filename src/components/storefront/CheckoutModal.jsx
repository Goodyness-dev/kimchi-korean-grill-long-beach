import React, { useState } from 'react';
import { formatCents } from '../../utils/currency.js';

export default function CheckoutModal({
  isOpen,
  onClose,
  quote,
  cartItems,
  location,
  onOrderSuccess
}) {
  if (!isOpen || !quote) return null;

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Persistent idempotency key per logical checkout attempt (Section 8)
  const [idempotencyKey] = useState(() => 'idem-' + Math.random().toString(36).substring(2) + Date.now().toString(36));

  async function handleSubmitOrder(e) {
    e.preventDefault();
    if (!customerName.trim() || !customerEmail.trim()) {
      setErrorMessage('Name and Email are required to receive your order status link.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          tenantId: 'tenant-kimchi',
          locationId: location?.id || 'loc-kimchi-lb',
          quoteToken: quote.quoteToken,
          customer: {
            name: customerName.trim(),
            email: customerEmail.trim(),
            phone: customerPhone.trim(),
            notes: customerNotes.trim()
          },
          items: cartItems.map(it => ({
            itemId: it.itemId,
            quantity: it.quantity,
            selectedOptionIds: it.selectedOptionIds,
            customerNotes: it.customerNotes
          }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('Menu prices or availability changed during checkout. Please review your cart.');
        }
        throw new Error(data.message || 'Failed to submit order');
      }

      onOrderSuccess(data);
    } catch (err) {
      setErrorMessage(err.message || 'Network error occurred. Result is uncertain. Please click retry with the same key.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="card-thick bg-neutral-950 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border-2 border-neutral-800">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-orange-950 border border-orange-800 text-orange-400 flex items-center justify-center font-bold text-sm">
              ðŸ§¾
            </span>
            <div>
              <h3 className="font-serif text-lg font-bold text-white">Pickup Confirmation</h3>
              <p className="text-xs text-neutral-400">Pay at counter upon arrival</p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmitOrder} className="p-5 overflow-y-auto space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Pickup Address & Lead Time Banner */}
          <div className="p-3.5 bg-neutral-900/80 border border-neutral-800 rounded-xl space-y-1 text-xs">
            <div className="flex justify-between font-semibold text-white">
              <span>Pickup Counter:</span>
              <span className="text-orange-400 font-mono">~{location?.lead_time_mins || 25} Mins</span>
            </div>
            <p className="text-neutral-400">{location?.address}</p>
            <p className="text-neutral-500 text-[11px] pt-1">
              Instructions: {location?.pickup_instructions}
            </p>
          </div>

          {/* Customer Inputs */}
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Your Full Name <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Marco Rossi"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Email Address <span className="text-orange-500">*</span>
                <span className="text-[11px] font-normal text-neutral-400 ml-1.5">(for order tracking link)</span>
              </label>
              <input
                type="email"
                required
                placeholder="e.g. marco@example.com"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Mobile Phone
                <span className="text-[11px] font-normal text-neutral-400 ml-1.5">(optional, in case of kitchen question)</span>
              </label>
              <input
                type="tel"
                placeholder="e.g. (540) 555-0199"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Pickup Notes
                <span className="text-[11px] font-normal text-neutral-400 ml-1.5">(e.g. Will arrive in black sedan)</span>
              </label>
              <input
                type="text"
                maxLength={200}
                placeholder="Optional note for pickup staff"
                value={customerNotes}
                onChange={e => setCustomerNotes(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition"
              />
            </div>
          </div>

          {/* Pay at Pickup Notice */}
          <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-1 text-xs">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold">âœ“</span>
              <span>Payment Collected In Person</span>
            </div>
            <p className="text-neutral-400 text-[11px]">
              You will pay <strong className="text-white font-mono">{formatCents(quote.totalMinor)}</strong> at our counter. We accept Cash, Visa, Mastercard, American Express, Apple Pay, and Google Pay.
            </p>
          </div>

          {/* Order Summary Snapshot */}
          <div className="pt-2 border-t border-neutral-800 space-y-1 text-xs text-neutral-300">
            <div className="flex justify-between">
              <span>Items ({cartItems.reduce((acc, i) => acc + i.quantity, 0)})</span>
              <span className="font-mono">{formatCents(quote.subtotalMinor)}</span>
            </div>
            <div className="flex justify-between">
              <span>Taxes (10.25%)</span>
              <span className="font-mono">{formatCents(quote.taxMinor)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-white pt-1">
              <span>Total to Pay at Pickup:</span>
              <span className="font-mono text-orange-400 text-base">{formatCents(quote.totalMinor)}</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-600/30 transition flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Transmitting Order to Kitchen...
              </span>
            ) : (
              <span>Submit Pickup Order â€¢ {formatCents(quote.totalMinor)}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
