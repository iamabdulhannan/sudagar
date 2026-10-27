# Saudagar (سوداگر)

Billing, POS, inventory and accounting for every kind of business: retail shops, grocery stores, wholesalers,
distributors, manufacturers, pharmacies, mobile and electronics shops, garments, hardware, restaurants,
service and repair businesses, and agri input dealers. In the spirit of Vyapar, built for Pakistan first
(PKR, GST / sales tax, NTN / STRN, Urdu) and usable anywhere.

Accounts and data live in Supabase (PostgreSQL), and every device keeps a synced copy, so it also works with no
internet. Install it as an app from the browser. Backups are one JSON file per business.

## What it does

- **Sales**: sale invoices, estimates / quotations, sale orders, delivery challans, payment in, sale returns
  (credit notes). Convert estimate → order → challan → invoice. Walk-in or credit (udhaar) customers, due dates,
  wholesale price list, discounts, tax, delivery charges, round off.
- **POS billing**: fast counter screen, hold bills, cash tendered and change, card / bank / JazzCash / Easypaisa,
  thermal receipts (80 / 58 mm), keyboard shortcuts.
- **Barcode scanners**: any USB or Bluetooth scanner in keyboard (HID) mode with Enter or Tab after the code.
  Scans work wherever the cursor is on the POS, bill and items screens; weighing-scale labels (EAN-13 starting
  with 2, item code + weight) add the right quantity. Phone camera scanning too.
- **Cash shifts (cash drawer)**: open with a counted float (note by note), pay in, pay out, cash drop to the safe
  or bank, no-sale drawer opens logged, X report mid-shift, blind count at closing, Z report, expected vs counted
  cash with the over / short posted to the books. Optional drawer kick through the receipt printer (Chrome / Edge).
- **Purchases**: purchase bills, payment out, purchase returns (debit notes), purchase orders.
- **Expenses and other income** by head (rent, salaries, electricity ...).
- **Inventory**: products and services, categories, two units per item (carton and piece), barcode and label
  printing, opening stock, low-stock alerts, stock adjustments (damage, count, own use), batches and expiry,
  serial / IMEI numbers, weighted average costing.
- **Parties (khata)**: customers and suppliers, opening balances, credit limits, running ledger statement,
  invoice-wise dues, WhatsApp payment reminders.
- **Cash & bank**: cash in hand, bank accounts and mobile wallets, transfers, cash book and bank book.
- **Accounting**: real double-entry books generated from every transaction: profit & loss, balance sheet,
  trial balance, cash flow, day book, tax report, receivables aging, item-wise and bill-wise profit,
  stock summary and movement.
- **Printing and sharing**: A4 / A5 invoices with logo and colour, thermal receipts, vouchers, share on WhatsApp,
  save as PDF from the print dialog.
- **Godowns and branches**: stock per godown, stock transfers, godown on every bill.
- **Manufacturing**: bill of materials per item, make finished goods from raw materials at true cost.
- **Cheques and loans**: cheques in hand until cleared (or bounced), bank loans with instalments and interest,
  owner capital and drawings.
- **Split payments**: part cash, part card / bank / wallet on one bill; change shown on the receipt.
- **Loyalty points**: customers earn points on purchases and redeem them as a discount.
- **Payment reminders**: list of who owes you, WhatsApp reminders one click each with your own message.
- **Users and PIN lock**: owner, manager, accountant and cashier roles on one device, auto-lock when idle.
- **Close the books**: lock a period (month or tax year) so old entries can't change; recycle bin to restore deletes.
- **Item catalogue**: printable or WhatsApp price list for customers; camera barcode scanning on phones.
- **Invoice designs**: classic, modern, compact and bold.
- **Auto backup** to a folder every day (Chrome / Edge on computers).
- **Multi-business**: several businesses on one device, each with its own data.
- **Feature switches per business type**: a pharmacy gets batches and MRP, an electronics shop gets serial numbers,
  a distributor gets orders and challans; anything can be turned on or off in Settings.
- English and Urdu (right to left), light and dark theme.

## Backend

- **Supabase**: PostgreSQL database + Auth (email and password accounts). Schema and security rules are in
  [supabase/migrations/001_init.sql](supabase/migrations/001_init.sql).
- **On each device**: a full copy of the account's businesses in IndexedDB (through Dexie), so the app works
  offline. Changes sync both ways (`src/lib/sync.ts`): on open, a moment after every change, every 30 seconds,
  when the internet comes back, and instantly through Supabase Realtime when another device changes something.
- **Accounts and teams**: anyone can sign up and create businesses (they are the owner). Owners and managers
  invite staff with a one-time code; each person signs in with their own account and role (manager, accountant,
  cashier). Row level security makes sure an account only ever reads or writes businesses it belongs to.

### Set up Supabase (once, about 5 minutes)

1. Create a free project at <https://supabase.com> (pick the region closest to your users, for example Singapore or Mumbai for Pakistan).
2. Open **SQL Editor**, paste the whole of `supabase/migrations/001_init.sql` and click **Run**. Then do the same
   for each later file in order (`002_shifts.sql`, ...).
3. **Authentication → URL Configuration**: set **Site URL** to your app address (`http://localhost:5173` while developing)
   and add `http://localhost:5173/**` plus your live address `/**` to **Redirect URLs** (needed for confirm-email and reset-password links).
4. **Authentication → Sign In / Providers → Email**: keep **Confirm email** on for production. Turn it off while testing
   if you want to sign in straight after sign-up. For real use, set up custom SMTP (Authentication → Emails), because
   Supabase's built-in mailer only sends a few emails per hour.
5. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   (**Project Settings → API**; use the anon public key, never the service-role key). Restart `npm run dev`.

Without a `.env` the app runs in device-only mode (no accounts), which is handy for development.

## Run

```bash
npm install
npm run dev        # http://localhost:5173 (landing page; the app is at /dashboard)
npm test           # accounting, sync and report tests, plus the database schema in PGlite
npm run build      # production build in dist/ (with offline service worker)
```

Deploy `dist/` to any static host (Vercel, Netlify, Cloudflare Pages) and add the two `VITE_SUPABASE_*` variables in its settings.

## Code

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Roadmap

- Android / iOS app (Capacitor wrapper of this app, or Expo).
- FBR POS integration (Pakistan) and e-invoicing.
- Online store, SMS reminders.
