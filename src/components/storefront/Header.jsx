import React, { useState, useEffect, useRef } from 'react';
export default function Header({ location, cartCount, onOpenCart, onOpenTracking }) {
  const [expanded, setExpanded] = useState(false);
  const header = useRef(null);
  useEffect(() => {
    const observer = new ResizeObserver(() => document.documentElement.style.setProperty('--header-height', `${header.current.offsetHeight}px`));
    observer.observe(header.current);
    return () => observer.disconnect();
  }, []);
  return <header ref={header} className="site-header">
    {location?.is_paused && <div className="pause-notice">Ordering is paused: {location.pause_reason || 'Kitchen at maximum capacity'}</div>}
    <div className="header-inner"><a href="#home" className="wordmark" aria-label="Kimchi Korean Grill home">kimchi<span>KOREAN GRILL</span></a><nav aria-label="Main navigation" className={expanded ? 'main-nav expanded' : 'main-nav'}><a href="#menu" onClick={() => setExpanded(false)}>The menu</a><a href="#visit" onClick={() => setExpanded(false)}>Find us</a><button onClick={() => { setExpanded(false); onOpenTracking(); }}>Track order</button></nav><div className="header-actions"><button className="bag-button" onClick={onOpenCart}>Your bag <span>{cartCount}</span></button><button className="mobile-toggle" aria-label={expanded ? 'Close navigation' : 'Open navigation'} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? '✕' : '☰'}</button></div></div>
  </header>;
}
