import React, { useEffect, useRef } from 'react';
export default function HeroBanner({ location }) {
  const image = useRef(null);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame;
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { if (image.current) image.current.style.transform = media.matches ? '' : `translateY(${Math.min(window.scrollY * .08, image.current.clientHeight * .05)}px) scale(1.12)`; }); };
    update(); window.addEventListener('scroll', update, { passive: true }); media.addEventListener('change', update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); media.removeEventListener('change', update); };
  }, []);
  return <section className="hero" id="home">
    <div className="hero-copy"><p className="eyebrow">KOREAN SOUL. LONG BEACH SPIRIT.</p><h1>A little heat.<br/>A lot of <em> Seoul.</em></h1><p className="hero-description">Flame-kissed barbecue. Crispy Korean chicken.<br className="desktop-break"/> Your favorite comfort food, fresh from our grill.</p><a className="primary-link" href="#menu">Explore the menu <span aria-hidden="true">↗</span></a><div className="hero-note"><span className="small-line"/>Made to order. Ready for pickup.</div></div>
    <div className="hero-photo"><img ref={image} src="https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1600&q=85" alt="Grilled ribs with a rich barbecue glaze" fetchPriority="high"/><div className="photo-caption"><span>FIRE. FLAVOR. FEELING.</span><span>김치</span></div></div>
    <a className="scroll-cue" href="#menu">SCROLL TO DISCOVER <span aria-hidden="true">↓</span></a>
    <div className="hero-bottom"><span>LONG BEACH, CALIFORNIA</span><span>Pickup in about {location?.lead_time_mins ?? 25} minutes</span></div>
  </section>;
}
