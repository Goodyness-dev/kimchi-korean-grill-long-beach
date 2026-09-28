import React, { useState } from 'react';

export default function StaffLogin({ onLoginSuccess, onCancel }) {
  const [username, setUsername] = useState('kitchen@kimchigrill.com');
  const [password, setPassword] = useState('admin2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleLogin(u, p) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/v1/staff/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u || username, password: p || password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Invalid credentials');
      }
      onLoginSuccess(data.token, data.staff);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="card-thick bg-neutral-950 w-full max-w-md p-6 sm:p-8 space-y-6 border-2 border-neutral-800 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-orange-950 border border-orange-800 text-orange-400 flex items-center justify-center mx-auto text-xl font-bold shadow-lg shadow-orange-900/40">
            K
          </div>
          <h3 className="font-serif text-2xl font-bold text-white">Staff Kitchen Portal</h3>
          <p className="text-xs text-neutral-400">Authenticate to manage incoming orders &amp; kitchen flow</p>
        </div>

        {error && (
          <div className="p-3 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>{error}</span>
          </div>
        )}

        {/* 1-Click Fast Demo Logins */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            Quick Demo Roles (1-Click)
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setUsername('kitchen@kimchigrill.com');
                setPassword('admin2026');
                handleLogin('kitchen@kimchigrill.com', 'admin2026');
              }}
              className="p-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-white text-center transition"
            >
              <div className="text-orange-400 font-bold">Kitchen</div>
              <div className="text-[10px] text-neutral-500">Staff</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setUsername('manager@kimchigrill.com');
                setPassword('admin2026');
                handleLogin('manager@kimchigrill.com', 'admin2026');
              }}
              className="p-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-white text-center transition"
            >
              <div className="text-blue-400 font-bold">Manager</div>
              <div className="text-[10px] text-neutral-500">Floor</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setUsername('owner@kimchigrill.com');
                setPassword('admin2026');
                handleLogin('owner@kimchigrill.com', 'admin2026');
              }}
              className="p-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-white text-center transition"
            >
              <div className="text-purple-400 font-bold">Owner</div>
              <div className="text-[10px] text-neutral-500">Full Access</div>
            </button>
          </div>
        </div>

        {/* Manual Login Form */}
        <form onSubmit={e => { e.preventDefault(); handleLogin(); }} className="space-y-4 pt-2 border-t border-neutral-900">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">Username / Email</label>
            <input
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 transition"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition"
            >
              Back
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 transition shadow-lg shadow-orange-600/30"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
