import React, { useEffect, useState } from 'react';
import { formatCents, formatTime } from '../../utils/currency.js';

export default function OrderStatusView({ publicRef, capabilityToken, onBackToStorefront }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState('');

  // Authoritative Polling (Section 10)
  useEffect(() => {
    let isMounted = true;

    async function fetchStatus() {
      try {
        const res = await fetch(`/v1/order-status/${publicRef}?token=${encodeURIComponent(capabilityToken)}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'Unable to load order status');
        }
        const data = await res.json();
        if (isMounted) {
          setOrder(data);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    fetchStatus();

    // Poll every 5 seconds while active
    const interval = setInterval(() => {
      if (order?.state && ['COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED'].includes(order.state)) {
        clearInterval(interval);
        return;
      }
      fetchStatus();
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [publicRef, capabilityToken, order?.state]);

  // Acceptance deadline countdown
  useEffect(() => {
    if (!order?.acceptanceDeadline || order?.state !== 'PENDING_ACCEPTANCE') {
      setTimeRemaining('');
      return;
    }

    const timer = setInterval(() => {
      const now = Date.now();
      const deadline = new Date(order.acceptanceDeadline).getTime();
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeRemaining('Deadline reached');
        clearInterval(timer);
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeRemaining(`${mins}m ${secs < 10 ? '0' : ''}${secs}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [order?.acceptanceDeadline, order?.state]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="card-thick p-8 max-w-md w-full text-center space-y-4">
          <svg className="animate-spin w-8 h-8 text-orange-500 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <p className="text-neutral-400 text-sm font-medium">Fetching authoritative order status...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="card-thick p-8 max-w-md w-full text-center space-y-4 border-red-900 bg-red-950/20">
          <div className="w-12 h-12 rounded-full bg-red-950 border border-red-800 text-red-400 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h3 className="font-serif text-xl font-bold text-white">Order Lookup Failed</h3>
          <p className="text-neutral-400 text-xs leading-relaxed">{error || 'Order not found'}</p>
          <button
            onClick={onBackToStorefront}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold border border-neutral-800 transition"
          >
            Return to Storefront
          </button>
        </div>
      </div>
    );
  }

  // Visual status steps
  const steps = [
    { key: 'PENDING_ACCEPTANCE', label: 'Order Transmitted', desc: 'Awaiting kitchen confirmation' },
    { key: 'ACCEPTED', label: 'Kitchen Preparing', desc: 'Food being cooked fresh' },
    { key: 'READY', label: 'Ready for Pickup', desc: 'Waiting hot at counter' },
    { key: 'COMPLETED', label: 'Collected', desc: 'Order complete' }
  ];

  const stateIndexMap = {
    PENDING_ACCEPTANCE: 0,
    ACCEPTED: 1,
    READY: 2,
    COMPLETED: 3,
    DECLINED: -1,
    EXPIRED: -1,
    CANCELLED: -1
  };

  const currentIndex = stateIndexMap[order.state] ?? 0;
  const isTerminalFailure = ['DECLINED', 'EXPIRED', 'CANCELLED'].includes(order.state);

  return (
    <div className="min-h-screen bg-neutral-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToStorefront}
            className="px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold border border-neutral-800 transition flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Storefront
          </button>

          <span className="font-mono text-xs font-bold text-neutral-400 bg-neutral-900 px-3 py-1 rounded-full border border-neutral-800">
            Reference: #{order.publicRef}
          </span>
        </div>

        {/* Primary Status Card */}
        <div className="card-thick p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-950 text-orange-400 border border-orange-800">
              Direct Kitchen Pickup
            </span>

            <h2 className="font-serif text-3xl font-extrabold text-white">
              {order.state === 'PENDING_ACCEPTANCE' && 'Waiting for Kitchen Acceptance'}
              {order.state === 'ACCEPTED' && 'Order Confirmed & Preparing!'}
              {order.state === 'READY' && '🎉 Your Order is Ready for Pickup!'}
              {order.state === 'COMPLETED' && 'Order Collected & Completed'}
              {order.state === 'DECLINED' && 'Order Could Not Be Accepted'}
              {order.state === 'EXPIRED' && 'Order Expired Unaccepted'}
              {order.state === 'CANCELLED' && 'Order Cancelled'}
            </h2>

            {/* Context Subtitle */}
            {order.state === 'PENDING_ACCEPTANCE' && (
              <p className="text-neutral-400 text-xs sm:text-sm max-w-md mx-auto">
                Preparation has not begun yet. Our kitchen staff is reviewing your ticket now.
                {timeRemaining && (
                  <span className="block font-mono text-orange-400 font-semibold mt-1">
                    Acceptance window closes in: {timeRemaining}
                  </span>
                )}
              </p>
            )}

            {order.state === 'ACCEPTED' && order.estimatedPickupAt && (
              <div className="p-4 bg-orange-950/40 border border-orange-800/80 rounded-2xl max-w-md mx-auto">
                <div className="text-xs text-orange-300 font-medium">Estimated Pickup Time:</div>
                <div className="font-mono text-2xl font-extrabold text-white">
                  {formatTime(order.estimatedPickupAt)}
                </div>
              </div>
            )}

            {order.state === 'READY' && (
              <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-2xl max-w-md mx-auto">
                <div className="text-xs text-emerald-300 font-medium">Head to Pickup Counter:</div>
                <div className="text-sm font-bold text-white mt-1">
                  Show your Order Reference <span className="font-mono text-orange-400 font-bold">#{order.publicRef}</span> at the counter.
                </div>
              </div>
            )}

            {isTerminalFailure && (
              <div className="p-4 bg-red-950/40 border border-red-800 rounded-2xl max-w-md mx-auto text-left space-y-1">
                <div className="text-xs font-bold text-red-300">Reason:</div>
                <p className="text-xs text-red-200">
                  {order.declineReason || order.cancelReason || 'Kitchen was unable to fulfill order before the acceptance deadline.'}
                </p>
                <p className="text-[11px] text-neutral-400 pt-1">
                  No payment was processed online. Feel free to call us at {order.location?.phone}.
                </p>
              </div>
            )}
          </div>

          {/* Stepper Progress Bar (for active progression) */}
          {!isTerminalFailure && (
            <div className="pt-4 border-t border-neutral-800">
              <div className="grid grid-cols-4 gap-2">
                {steps.map((s, idx) => {
                  const isDone = currentIndex >= idx;
                  const isCurrent = currentIndex === idx;

                  return (
                    <div key={s.key} className="space-y-2 text-center">
                      <div className={`h-2 rounded-full transition-all duration-500 ${
                        isDone ? 'bg-orange-500 shadow-md shadow-orange-500/50' : 'bg-neutral-800'
                      }`} />
                      <div className="space-y-0.5">
                        <div className={`text-[11px] font-bold ${
                          isCurrent ? 'text-orange-400' : isDone ? 'text-white' : 'text-neutral-500'
                        }`}>
                          {s.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Location & Pickup Instructions Card */}
        <div className="card-thick p-5 space-y-3">
          <h4 className="font-serif text-base font-bold text-white flex items-center gap-2">
            <span>📍 Pickup Instructions</span>
          </h4>
          <div className="text-xs space-y-1 text-neutral-300">
            <div className="font-semibold text-white">{order.location?.name}</div>
            <p className="text-neutral-400">{order.location?.address}</p>
            <p className="text-neutral-400">Phone: {order.location?.phone}</p>
            <div className="pt-2 text-orange-300/90 bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-800">
              {order.location?.pickupInstructions}
            </div>
          </div>
        </div>

        {/* Order Details Receipt Card */}
        <div className="card-thick p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
            <h4 className="font-serif text-base font-bold text-white">Itemized Receipt</h4>
            <span className="text-xs font-mono text-neutral-400">Customer: {order.customerName}</span>
          </div>

          <div className="space-y-3 divide-y divide-neutral-900">
            {order.items?.map((it, idx) => (
              <div key={idx} className="pt-2 first:pt-0 space-y-1">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="font-bold text-white">
                    {it.quantity}x {it.name}
                  </span>
                  <span className="font-mono font-semibold text-neutral-200">
                    {formatCents(it.subtotalMinor)}
                  </span>
                </div>

                {it.options && it.options.length > 0 && (
                  <div className="text-[11px] text-neutral-400 pl-4 space-y-0.5">
                    {it.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex justify-between">
                        <span>+ {opt.name}</span>
                        {opt.priceDeltaMinor > 0 && (
                          <span className="font-mono text-neutral-500">
                            +{formatCents(opt.priceDeltaMinor)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-neutral-800 space-y-1 text-xs">
            <div className="flex justify-between text-neutral-400">
              <span>Subtotal</span>
              <span className="font-mono">{formatCents(order.subtotalMinor)}</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>Taxes</span>
              <span className="font-mono">{formatCents(order.taxMinor)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-neutral-800/60">
              <span>Total to Pay at Pickup</span>
              <span className="font-mono text-orange-400 text-base">{formatCents(order.totalMinor)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
