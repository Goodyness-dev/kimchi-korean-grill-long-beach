import React, { useEffect, useState, useRef } from 'react';
import { formatCents, formatTime, formatDateTime } from '../../utils/currency.js';
import { playOrderChime, testAudioAlert } from '../../utils/audio.js';

export default function StaffDashboard({
  token,
  staff,
  onLogout,
  onBackToStorefront
}) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('ACTIVE'); // 'ACTIVE', 'PENDING', 'HISTORY'
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [show86Modal, setShow86Modal] = useState(false);
  const [declineTargetOrder, setDeclineTargetOrder] = useState(null);
  const [declineReason, setDeclineReason] = useState('Kitchen at maximum capacity for the dinner rush');

  const prevPendingCountRef = useRef(0);

  // Poll orders every 3.5 seconds
  async function fetchOrders() {
    try {
      const res = await fetch(`/v1/staff/orders?filter=${filter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        onLogout();
        return;
      }
      const data = await res.json();
      const currentOrders = data.orders || [];

      // Detect newly arrived pending orders for audio bell chime
      const pendingCount = currentOrders.filter(o => o.state === 'PENDING_ACCEPTANCE').length;
      if (audioEnabled && pendingCount > prevPendingCountRef.current) {
        playOrderChime();
      }
      prevPendingCountRef.current = pendingCount;

      setOrders(currentOrders);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch staff orders:', err);
    }
  }

  // Load menu items for 86 management
  async function fetchMenuFor86() {
    try {
      const res = await fetch('/v1/storefront/menu');
      const data = await res.json();
      const items = [];
      for (const cat of data.categories || []) {
        for (const it of cat.items || []) {
          items.push(it);
        }
      }
      setMenuItems(items);
      setIsPaused(Boolean(data.location?.is_paused));
    } catch (err) {
      console.error('Failed to fetch menu:', err);
    }
  }

  useEffect(() => {
    fetchOrders();
    fetchMenuFor86();
    const interval = setInterval(fetchOrders, 3500);
    return () => clearInterval(interval);
  }, [filter, audioEnabled, token]);

  // Action handlers with optimistic concurrency error handling
  async function handleAccept(orderId, expectedVersion, pickupMinutes) {
    setActionError(null);
    try {
      const res = await fetch(`/v1/staff/orders/${orderId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ expectedVersion, pickupMinutes })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to accept order');
      }
      fetchOrders();
    } catch (err) {
      setActionError(`Conflict: ${err.message}`);
      fetchOrders();
    }
  }

  async function handleDecline(orderId, expectedVersion) {
    setActionError(null);
    try {
      const res = await fetch(`/v1/staff/orders/${orderId}/decline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ expectedVersion, reason: declineReason })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to decline order');
      }
      setDeclineTargetOrder(null);
      fetchOrders();
    } catch (err) {
      setActionError(`Conflict: ${err.message}`);
      fetchOrders();
    }
  }

  async function handleMarkReady(orderId, expectedVersion) {
    setActionError(null);
    try {
      const res = await fetch(`/v1/staff/orders/${orderId}/ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ expectedVersion })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to mark ready');
      }
      fetchOrders();
    } catch (err) {
      setActionError(`Conflict: ${err.message}`);
      fetchOrders();
    }
  }

  async function handleComplete(orderId, expectedVersion) {
    setActionError(null);
    try {
      const res = await fetch(`/v1/staff/orders/${orderId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ expectedVersion })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to complete order');
      }
      fetchOrders();
    } catch (err) {
      setActionError(`Conflict: ${err.message}`);
      fetchOrders();
    }
  }

  async function handleTogglePause() {
    setActionError(null);
    try {
      const nextPaused = !isPaused;
      const res = await fetch('/v1/staff/ordering', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          isPaused: nextPaused,
          pauseReason: nextPaused ? 'Kitchen paused orders due to sudden dinner rush' : null
        })
      });
      if (!res.ok) throw new Error('Failed to update pause state');
      setIsPaused(nextPaused);
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleToggle86(itemId, currentAvailable) {
    try {
      const res = await fetch('/v1/staff/availability', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ itemId, isAvailable: !currentAvailable })
      });
      if (res.ok) {
        fetchMenuFor86();
      }
    } catch (err) {
      console.error('Failed to toggle item availability:', err);
    }
  }

  const pendingCount = orders.filter(o => o.state === 'PENDING_ACCEPTANCE').length;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Top Staff Navigation Bar */}
      <header className="sticky top-0 z-30 bg-neutral-900/95 backdrop-blur-md border-b-2 border-neutral-800 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Identity & Status */}
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center font-bold text-white shadow-md shadow-orange-600/30">
              🍳
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif font-bold text-base text-white">Kitchen Display &amp; Operations</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-orange-950 text-orange-400 border border-orange-800">
                  {staff?.role || 'KITCHEN'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Logged in as <strong className="text-white">{staff?.username}</strong>
              </p>
            </div>
          </div>

          {/* Operational Quick Actions */}
          <div className="flex items-center gap-2">
            {/* Audio Alert Bell Button */}
            <button
              onClick={() => {
                testAudioAlert();
                setAudioEnabled(true);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                audioEnabled
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
              }`}
              title="Test audio chime and unlock browser sound policy"
            >
              <span>{audioEnabled ? '🔔 Sound ON' : '🔕 Enable Sound'}</span>
            </button>

            {/* 86 Menu Manager button */}
            <button
              onClick={() => setShow86Modal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition"
            >
              86 Menu Items
            </button>

            {/* Pause Ordering Toggle */}
            <button
              onClick={handleTogglePause}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                isPaused
                  ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/30'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
              }`}
            >
              {isPaused ? '🔴 RESUME ORDERS' : '⏸ Pause Storefront'}
            </button>

            {/* Storefront switch */}
            <button
              onClick={onBackToStorefront}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition"
            >
              Storefront
            </button>

            {/* Sign Out */}
            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Conflict / Action Error Alert */}
      {actionError && (
        <div className="bg-amber-950 border-b border-amber-800 text-amber-200 px-4 py-2.5 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-amber-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Filter Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('ACTIVE')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
                filter === 'ACTIVE'
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              <span>Active Orders</span>
              <span className="px-1.5 py-0.2 rounded-md bg-neutral-950/80 text-xs">
                {orders.length}
              </span>
            </button>

            <button
              onClick={() => setFilter('PENDING')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
                filter === 'PENDING'
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              <span>Pending Acceptance</span>
              {pendingCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              )}
            </button>

            <button
              onClick={() => setFilter('HISTORY')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                filter === 'HISTORY'
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              Archived History
            </button>
          </div>

          <div className="text-xs text-neutral-500 hidden sm:block">
            Auto-refreshing every 3.5s · Optimistic concurrency guarded
          </div>
        </div>

        {/* Order Cards Grid */}
        {loading && orders.length === 0 ? (
          <div className="text-center py-20 text-neutral-500 text-sm">
            Connecting to kitchen dispatch...
          </div>
        ) : orders.length === 0 ? (
          <div className="card-thick p-12 text-center space-y-3">
            <div className="text-4xl">🍕</div>
            <h3 className="font-serif text-lg font-bold text-white">No orders in this view</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              {filter === 'ACTIVE'
                ? 'All kitchen tickets are clear! New customer orders will show up here immediately with sound notification.'
                : 'No historical or pending tickets matching this filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {orders.map(order => {
              const isPending = order.state === 'PENDING_ACCEPTANCE';
              const isAccepted = order.state === 'ACCEPTED';
              const isReady = order.state === 'READY';
              const isComplete = order.state === 'COMPLETED';

              return (
                <div
                  key={order.id}
                  className={`card-thick p-5 flex flex-col justify-between space-y-4 border-2 transition ${
                    isPending
                      ? 'border-amber-500/80 bg-neutral-900 shadow-2xl shadow-amber-500/10 animate-pulse'
                      : isReady
                      ? 'border-emerald-600/80 bg-neutral-900'
                      : 'border-neutral-800'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-neutral-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-extrabold text-white">
                          #{order.public_ref}
                        </span>
                        <span className="text-xs font-mono text-neutral-500">
                          v{order.version}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-300 font-bold mt-0.5">
                        {order.customer_name}
                      </div>
                      {order.customer_phone && (
                        <div className="text-[11px] text-neutral-400">
                          📞 {order.customer_phone}
                        </div>
                      )}
                    </div>

                    <div className="text-right space-y-1">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wide ${
                        isPending
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : isAccepted
                          ? 'bg-blue-950 text-blue-300 border border-blue-800'
                          : isReady
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {order.state.replace('_', ' ')}
                      </span>
                      <div className="text-[10px] text-neutral-500 font-mono">
                        {formatTime(order.created_at)}
                      </div>
                    </div>
                  </div>

                  {/* Customer Pickup Note if any */}
                  {order.customer_notes && (
                    <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-amber-300 italic">
                      ⚠️ Note: &quot;{order.customer_notes}&quot;
                    </div>
                  )}

                  {/* Estimated Pickup Time if accepted */}
                  {isAccepted && order.estimated_pickup_at && (
                    <div className="p-2.5 bg-blue-950/40 border border-blue-900/60 rounded-xl flex items-center justify-between text-xs">
                      <span className="text-blue-300 font-medium">Kitchen Target:</span>
                      <span className="font-mono font-bold text-white text-sm">
                        {formatTime(order.estimated_pickup_at)}
                      </span>
                    </div>
                  )}

                  {/* Items Ticket Body */}
                  <div className="space-y-2.5 flex-1 divide-y divide-neutral-900">
                    {order.items?.map((it, idx) => (
                      <div key={idx} className="pt-2 first:pt-0 space-y-0.5">
                        <div className="flex justify-between text-xs sm:text-sm font-bold text-white">
                          <span>{it.quantity}x {it.name}</span>
                          <span className="font-mono text-neutral-400 text-xs font-normal">
                            {formatCents(it.subtotalMinor)}
                          </span>
                        </div>
                        {it.options && it.options.length > 0 && (
                          <div className="text-[11px] text-neutral-400 pl-3">
                            {it.options.map((opt, oIdx) => (
                              <div key={oIdx}>• {opt.name}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Order Total & Action Controls */}
                  <div className="pt-3 border-t border-neutral-800 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-400">Total at Counter:</span>
                      <span className="font-mono text-sm font-bold text-white">
                        {formatCents(order.total_minor)}
                      </span>
                    </div>

                    {/* Pending Acceptance Action Buttons */}
                    {isPending && (
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                          Accept with Pickup Time:
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => handleAccept(order.id, order.version, 15)}
                            className="py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition"
                          >
                            +15 min
                          </button>
                          <button
                            onClick={() => handleAccept(order.id, order.version, 25)}
                            className="py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition"
                          >
                            +25 min
                          </button>
                          <button
                            onClick={() => handleAccept(order.id, order.version, 40)}
                            className="py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition"
                          >
                            +40 min
                          </button>
                        </div>
                        <button
                          onClick={() => setDeclineTargetOrder(order)}
                          className="w-full py-1.5 text-xs text-red-400 hover:text-red-300 font-semibold transition"
                        >
                          Decline Order
                        </button>
                      </div>
                    )}

                    {/* Accepted State Action */}
                    {isAccepted && (
                      <button
                        onClick={() => handleMarkReady(order.id, order.version)}
                        className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-600/30 transition flex items-center justify-center gap-1.5"
                      >
                        <span>🔔 Mark Ready for Pickup</span>
                      </button>
                    )}

                    {/* Ready State Action */}
                    {isReady && (
                      <button
                        onClick={() => handleComplete(order.id, order.version)}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-1.5"
                      >
                        <span>✓ Customer Collected / Complete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Decline Reason Modal */}
      {declineTargetOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card-thick bg-neutral-950 w-full max-w-md p-6 space-y-4 border-2 border-red-900">
            <h3 className="font-serif text-lg font-bold text-white">Decline Order #{declineTargetOrder.public_ref}</h3>
            <p className="text-xs text-neutral-400">
              Provide a customer-safe explanation that will be displayed on their tracking screen.
            </p>
            <textarea
              rows="3"
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeclineTargetOrder(null)}
                className="px-4 py-2 text-xs text-neutral-400 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={() => handleDecline(declineTargetOrder.id, declineTargetOrder.version)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 86 Menu Manager Modal */}
      {show86Modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card-thick bg-neutral-950 w-full max-w-xl max-h-[85vh] flex flex-col p-6 space-y-4 border-2 border-neutral-800">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-white">86 Item Availability Manager</h3>
                <p className="text-xs text-neutral-400">Toggle items sold out instantly on the live storefront</p>
              </div>
              <button onClick={() => setShow86Modal(false)} className="text-neutral-400 hover:text-white">✕</button>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {menuItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
                  <div>
                    <div className="font-bold text-white">{item.name}</div>
                    <div className="text-[11px] text-neutral-400 font-mono">{formatCents(item.price_minor)}</div>
                  </div>
                  <button
                    onClick={() => handleToggle86(item.id, item.is_available)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      item.is_available
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-red-950 hover:text-red-300'
                        : 'bg-red-950 text-red-300 border border-red-800 hover:bg-emerald-950 hover:text-emerald-300'
                    }`}
                  >
                    {item.is_available ? 'Available (Click to 86)' : 'Sold Out (86\'d)'}
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-neutral-800 flex justify-end">
              <button
                onClick={() => setShow86Modal(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-xl"
              >
                Close Manager
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
