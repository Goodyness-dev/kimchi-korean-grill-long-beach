import React from 'react';

export default function HeroBanner({ location }) {
  return (
    <div className="relative overflow-hidden bg-neutral-900/60 border-b border-neutral-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-orange-950/60 text-orange-400 border border-orange-800/60">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
              Authentic Open-Flame Korean BBQ &amp; Sizzling Dolsot Bowls
            </div>
            
            <h2 className="font-serif text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Sizzling BBQ. Crispy Chicken. <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-red-400">
                Direct From Chef Jun&apos;s Grill.
              </span>
            </h2>

            <p className="text-neutral-300 text-sm sm:text-base max-w-2xl leading-relaxed">
              Order directly from Kimchi Korean Grill with zero hidden third-party delivery fees. 
              Every plate of Prime Bulgogi, Kalbi short ribs, and crispy Korean fried chicken is cooked fresh to order. 
              Pay in person upon collection at our Long Beach pickup counter.
            </p>

            {/* Operational badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="card-thick p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-950/80 border border-orange-800/80 flex items-center justify-center text-orange-400 shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs text-neutral-400 font-medium">Pickup Lead Time</div>
                  <div className="text-sm font-bold text-white font-mono">~{location?.lead_time_mins || 25} Mins</div>
                </div>
              </div>

              <div className="card-thick p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400 shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs text-neutral-400 font-medium">Payment at Pickup</div>
                  <div className="text-sm font-bold text-white">Cash / Card / Apple Pay</div>
                </div>
              </div>

              <div className="card-thick p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-800/80 flex items-center justify-center text-blue-400 shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs text-neutral-400 font-medium">Pickup Location</div>
                  <div className="text-xs font-semibold text-white truncate max-w-[150px]" title={location?.address}>
                    {location?.address}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 hidden lg:block">
            <div className="relative rounded-2xl overflow-hidden border-2 border-neutral-800 shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80"
                alt="Chef Jun grilling fresh Kalbi short ribs over flame"
                className="w-full h-64 object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent"></div>
              <div className="absolute bottom-3 left-3 right-3 text-xs text-neutral-300 font-medium bg-neutral-950/80 backdrop-blur-sm p-2 rounded-lg border border-neutral-800">
                🥩 Open flame Korean BBQ with artisanal pear-soy marinades
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}