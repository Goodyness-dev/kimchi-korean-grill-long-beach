import React, { useState, useEffect } from 'react';
import Header from './components/storefront/Header.jsx';
import HeroBanner from './components/storefront/HeroBanner.jsx';
import CategoryNav from './components/storefront/CategoryNav.jsx';
import MenuGrid from './components/storefront/MenuGrid.jsx';
import ItemModal from './components/storefront/ItemModal.jsx';
import CartDrawer from './components/storefront/CartDrawer.jsx';
import CheckoutModal from './components/storefront/CheckoutModal.jsx';
import OrderStatusView from './components/tracking/OrderStatusView.jsx';
import StaffLogin from './components/staff/StaffLogin.jsx';
import StaffDashboard from './components/staff/StaffDashboard.jsx';
import { getFallbackMenu } from './utils/mockBackend.js';

export default function App() {
  const [view, setView] = useState('STOREFRONT'); // 'STOREFRONT', 'TRACKING', 'STAFF'
  const [menuData, setMenuData] = useState(null);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  // Cart state persisted in localStorage
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem('kimchi_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modals & Drawers
  const [activeItemModal, setActiveItemModal] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeQuoteForCheckout, setActiveQuoteForCheckout] = useState(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Customer Tracking Capability state
  const [trackingTarget, setTrackingTarget] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    const token = urlParams.get('token');
    if (ref && token) return { ref, token };
    try {
      const savedOrder = localStorage.getItem('kimchi_last_order');
      return savedOrder ? JSON.parse(savedOrder) : null;
    } catch {
      return null;
    }
  });

  // Manual tracking prompt modal
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [inputRef, setInputRef] = useState('');
  const [inputToken, setInputToken] = useState('');

  // Staff state
  const [staffToken, setStaffToken] = useState(() => localStorage.getItem('kimchi_staff_token') || null);
  const [staffProfile, setStaffProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('kimchi_staff_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [showStaffLogin, setShowStaffLogin] = useState(false);

  // Save cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('kimchi_cart', JSON.stringify(cartItems));
    } catch {}
  }, [cartItems]);

  // Fetch Storefront Menu
  async function loadMenu() {
    try {
      setLoadingMenu(true);
      const res = await fetch('/v1/storefront/menu');
      const data = await res.json();
      setMenuData(data);
    } catch (err) {
      console.log('Using embedded Kimchi Grill menu for Vercel demo:', err.message);
      setMenuData(getFallbackMenu());
    } finally {
      setLoadingMenu(false);
    }
  }

  useEffect(() => {
    loadMenu();
    // Check if initial URL points to order tracking
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('ref') && urlParams.get('token')) {
      setView('TRACKING');
    }
  }, []);

  // Cart operations
  function handleAddToCart(itemLine) {
    setCartItems(prev => [...prev, itemLine]);
    setIsCartOpen(true);
  }

  function handleUpdateQuantity(index, nextQty) {
    if (nextQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    setCartItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], quantity: nextQty };
      return copy;
    });
  }

  function handleRemoveItem(index) {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  }

  function handleProceedToCheckout(serverQuote) {
    setActiveQuoteForCheckout(serverQuote);
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  }

  function handleOrderSuccess(orderResult) {
    // Clear cart
    setCartItems([]);
    setIsCheckoutOpen(false);

    // Save last order capability token
    const trackingInfo = {
      ref: orderResult.publicRef,
      token: orderResult.capabilityToken
    };
    try {
      localStorage.setItem('kimchi_last_order', JSON.stringify(trackingInfo));
    } catch {}

    setTrackingTarget(trackingInfo);
    setView('TRACKING');
  }

  // Staff login success
  function handleStaffLoginSuccess(token, profile) {
    setStaffToken(token);
    setStaffProfile(profile);
    localStorage.setItem('kimchi_staff_token', token);
    localStorage.setItem('kimchi_staff_profile', JSON.stringify(profile));
    setShowStaffLogin(false);
    setView('STAFF');
  }

  function handleStaffLogout() {
    setStaffToken(null);
    setStaffProfile(null);
    localStorage.removeItem('kimchi_staff_token');
    localStorage.removeItem('kimchi_staff_profile');
    setView('STOREFRONT');
  }

  async function handleResetDemo() {
    if (confirm('Reset demo restaurant to original pristine state?')) {
      await fetch('/v1/demo/reset', { method: 'POST' });
      localStorage.removeItem('kimchi_cart');
      localStorage.removeItem('kimchi_last_order');
      window.location.reload();
    }
  }

  // Compute Cart Item Count & Total
  const cartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);
  const cartSubtotal = cartItems.reduce((acc, i) => acc + (i.unitPriceMinor * i.quantity), 0);

  // If in Tracking View
  if (view === 'TRACKING' && trackingTarget) {
    return (
      <OrderStatusView
        publicRef={trackingTarget.ref}
        capabilityToken={trackingTarget.token}
        onBackToStorefront={() => setView('STOREFRONT')}
      />
    );
  }

  // If in Staff View
  if (view === 'STAFF') {
    if (!staffToken) {
      return (
        <StaffLogin
          onLoginSuccess={handleStaffLoginSuccess}
          onCancel={() => setView('STOREFRONT')}
        />
      );
    }
    return (
      <StaffDashboard
        token={staffToken}
        staff={staffProfile}
        onLogout={handleStaffLogout}
        onBackToStorefront={() => setView('STOREFRONT')}
      />
    );
  }

  return (
    <div className="storefront min-h-screen flex flex-col">
      {/* Storefront Header */}
      <Header
        location={menuData?.location}
        cartCount={cartCount}
        cartTotal={cartSubtotal}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenStaff={() => {
          if (staffToken) setView('STAFF');
          else setShowStaffLogin(true);
        }}
        onOpenTracking={() => {
          if (trackingTarget) {
            setView('TRACKING');
          } else {
            setShowTrackModal(true);
          }
        }}
        onResetDemo={handleResetDemo}
      />

      {/* Hero Presentation */}
      <HeroBanner location={menuData?.location} />

      <section id="menu" className="menu-intro"><div><p className="eyebrow">FROM OUR KITCHEN</p><h2>Find your new favorite.</h2></div><p>Big flavors. Simple pleasures.<br/>Choose your dish. We will take care of the rest.</p></section>
      <CategoryNav
        categories={menuData?.categories || []}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
      />

      {/* Menu Grid */}
      <main className="flex-1">
        {loadingMenu ? (
          <div className="text-center py-24 space-y-3">
            <svg className="animate-spin w-8 h-8 text-orange-500 mx-auto" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <p className="text-neutral-400 text-xs font-semibold">Loading the menu…</p>
          </div>
        ) : (
          <MenuGrid
            categories={menuData?.categories || []}
            selectedCategoryId={selectedCategoryId}
            onItemClick={item => setActiveItemModal(item)}
          />
        )}
      </main>

      <section id="visit" className="visit-section">
        <div><p className="eyebrow">GOOD FOOD. CLOSE TO HOME.</p><h2>See you at<br/>the pickup counter.</h2><a className="text-link" href={menuData?.location?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(menuData.location.address)}` : '#visit'} target="_blank" rel="noreferrer">Get directions ↗</a></div>
        <div className="visit-details"><div><span>FIND US</span><p>{menuData?.location?.address}</p>{menuData?.location?.phone && <a href={`tel:${menuData.location.phone.replace(/[^+\d]/g, '')}`}>{menuData.location.phone}</a>}</div><div><span>YOUR ORDER, YOUR WAY</span><p>Order here. Pick up at our counter.<br/>Pay when you arrive.</p></div></div>
      </section>
      <footer className="site-footer"><a className="wordmark" href="#home">kimchi<span>KOREAN GRILL · LONG BEACH</span></a><p>A little Seoul in Long Beach.</p><button onClick={() => { if (staffToken) setView('STAFF'); else setShowStaffLogin(true); }}>Staff access ↗</button></footer>
      {/* Item Customization Modal */}
      {activeItemModal && (
        <ItemModal
          item={activeItemModal}
          onClose={() => setActiveItemModal(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Cart Slide-Over Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onProceedToCheckout={handleProceedToCheckout}
        location={menuData?.location}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        quote={activeQuoteForCheckout}
        cartItems={cartItems}
        location={menuData?.location}
        onOrderSuccess={handleOrderSuccess}
      />

      {/* Staff Login Modal */}
      {showStaffLogin && (
        <StaffLogin
          onLoginSuccess={handleStaffLoginSuccess}
          onCancel={() => setShowStaffLogin(false)}
        />
      )}

      {/* Lookup Order Modal */}
      {showTrackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card-thick bg-neutral-950 w-full max-w-md p-6 space-y-4 border-2 border-neutral-800">
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-lg font-bold text-white">Track Your Order</h3>
              <button aria-label="Close tracking" onClick={() => setShowTrackModal(false)} className="text-neutral-400 hover:text-white">×</button>
            </div>
            <p className="text-xs text-neutral-400">
              Enter the order reference and tracking code from your order confirmation.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Order Reference</label>
                <input
                  type="text"
                  placeholder="e.g. TK-4821"
                  value={inputRef}
                  onChange={e => setInputRef(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Tracking code</label>
                <input
                  type="text"
                  placeholder="Paste your tracking code"
                  value={inputToken}
                  onChange={e => setInputToken(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowTrackModal(false)}
                className="px-4 py-2 text-xs text-neutral-400"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (inputRef && inputToken) {
                    setTrackingTarget({ ref: inputRef.trim(), token: inputToken.trim() });
                    setShowTrackModal(false);
                    setView('TRACKING');
                  }
                }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl"
              >
                Track Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
