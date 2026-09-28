# Kimchi Korean Grill (Long Beach, CA)
> **Direct 0% Commission Online Ordering & Kitchen Operations Super Demo**
> Built upon Production Specification v1.0 (Modular Monolith with Transactional Outbox)

---

## 🥩 Brand & Location Metadata
- **Business**: Kimchi Korean Grill
- **Cuisine**: Authentic Open-Flame Korean BBQ, Sizzling Dolsot Bibimbap & Crispy Korean Fried Chicken
- **Head Chef / Owner**: Chef Jun
- **Address**: 1830 E 4th St, Long Beach, CA 90802
- **Phone**: (562) 555-1033
- **Hours**: Mon–Thu: 11:30 AM – 9:30 PM | Fri–Sat: 11:30 AM – 10:30 PM | Sun: 12:00 PM – 9:00 PM
- **Payment Model**: Pay-in-person upon collection (Cash, Visa, MC, Amex, Apple Pay, Google Pay). No online credit card transaction fees.

---

## 👨‍🍳 Staff Kitchen Operations Portal
- **Kitchen Portal URL**: Click **"Staff Portal"** in header or open `/` with staff login modal.
- **Demo Access Logins**:
  - `kitchen@kimchigrill.com` / `admin2026` (Role: **KITCHEN**)
  - `manager@kimchigrill.com` / `admin2026` (Role: **MANAGER**)
  - `owner@kimchigrill.com` / `admin2026` (Role: **OWNER**)
- **1-Click Autofill**: Preset quick-fill buttons on the login screen for instant demo presentation.

---

## ⚡ Super Demo Platform Capabilities
1. **Authoritative Minor-Unit Pricing**:
   - Every price and option delta calculated in integer cents.
   - Long Beach 10.25% sales tax (`1025` basis points) calculated server-side.
   - Cryptographically signed quote token with 10-minute validity.
2. **Idempotent Order Creation**:
   - `Idempotency-Key` prevents double-charges or duplicate orders under network retries.
   - 24-hour replay cache returning authoritative order state.
3. **Order Lifecycle FSM**:
   - `PENDING_ACCEPTANCE` ➔ `ACCEPTED` ➔ `READY` ➔ `COMPLETED`
   - Terminal failure states: `DECLINED`, `EXPIRED`, `CANCELLED`
   - Strict versioning (`WHERE id = ? AND version = ? AND state = ?`) preventing concurrent staff conflicts.
4. **Kitchen Display System (KDS)**:
   - Live incoming queue sorted by wait time with visual urgency pulsing.
   - Browser Audio Gesture-compliant dual-tone kitchen chime using native Web Audio synthesis.
   - 1-tap accept with pickup estimate (`+15 min`, `+25 min`, `+40 min`).
   - 86 Item Availability Manager (live sold-out toggling).
   - Emergency Storefront Ordering Pause switch.
5. **Private Customer Tracking**:
   - High-entropy capability tokens (`/order-status/TK-XXXX?token=...`).
   - Live polling with countdown timer to acceptance deadline.
6. **Transactional Outbox & Expiry Sweeper**:
   - Durable notification dispatch with lease-locking.
   - Sweeper clears unaccepted orders automatically past deadline.

---

## 🚀 How to Run the Super Demo

```powershell
cd "C:\Users\DELL\Documents\kimchi-korean-grill-long-beach"

# 1. Run full 8-suite integration test
npm test

# 2. Launch full super demo (API on :5050, Worker, Storefront on :3000)
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Visit **http://localhost:3000** to explore the storefront, submit an order, track it live, and manage it in the kitchen display!