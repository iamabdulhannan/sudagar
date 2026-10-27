# Saudagar architecture

Saudagar is a local-first billing, POS, inventory and accounting app for every kind of business
(retail, wholesale, distributor, pharmacy, services and more). React 19 + Vite + TypeScript + Tailwind v4,
data in IndexedDB through Dexie. English and Urdu (RTL).

## Data

- `src/lib/types.ts`: the whole domain model. Read it first.
- `src/lib/db.ts`: Dexie databases. `meta` lists businesses; each business has its own `FirmDB`
  (`settings`, `items`, `categories`, `parties`, `partyGroups`, `accounts`, `moneyCategories`, `txns`, `adjustments`, `audit`).
  Helpers: `uid()`, `today()`, `addDays()`.
- `src/lib/data.tsx`: `useData()` returns everything of the open business, already loaded and sorted
  (`items`, `parties`, `accounts`, `txns` newest first, `settings`, `firm`, `db`, lookup maps `itemById`,
  `partyById`, `accountById`, `txnById`, and `qty` = stock on hand per item). It is live: any write to `db`
  re-renders. `useBooks()` returns the accounting books (see below), built lazily and cached per data change.
- Write directly with Dexie (`db.items.put(...)`) for masters. For transactions ALWAYS use `saveTxn`,
  `cancelTxn`, `deleteTxn` from `src/lib/txn.ts` (numbering, validation, audit).

## Transactions (`src/lib/txn.ts`)

All documents are one `Txn` record with a `type`: sale, sale_return, estimate, sale_order, delivery_challan,
purchase, purchase_return, purchase_order, payment_in, payment_out, expense, other_income, transfer.
`TXN_META[type]` says its side, stock effect, whether it posts to the books, if a party is required,
what it converts to, its i18n label key (`tt_<type>` singular, `tp_<type>` plural) and URL slug.

- `blankTxn(type, settings)`, `lineFor(item, side, party, settings, qty)`, `calcLine`, `calcTotals(txn, settings)`.
  Always run `calcTotals` before saving a document with lines.
- `received` = amount paid now (cash/bank `accountId`). Walk-in (no party) must be paid in full.
- `convertDraft(from, toType, settings)` builds an invoice from an estimate/order/challan, or a return from an invoice.
- `validate()` returns an i18n error key; `saveTxn` throws `TxnError` (`err.problem.key`).
- Line `factor` = base units per line unit (alt unit support). Stock uses `qty * factor`.

## Accounting (`src/lib/ledger.ts`)

Nothing is stored; the books are rebuilt from transactions. `useBooks()` gives:
- `balances` per ledger account: `acc:<id>` (cash/bank), `party:<id>` (+ receivable, - payable), `inventory`, `sales`, `cogs`, `exp:<catId>`, ...
- `stock` per item: `{ qty, value, avgCost }` (weighted average cost)
- `dues` per sale/purchase invoice: `{ paid, due, status }` (payments settle oldest first)
- `cogs` per sale / sale return txn id, and `lineCogs` per line (same order as `txn.lines`)
- `postings` (double entry) for custom reports.

Report helpers: `profitLoss(books, from, to)`, `balanceSheet(books, asOf)`, `trialBalance`, `statement(books, acct, from, to)`
(running ledger for a party or cash/bank account), `acctName(acct, names, t)`, `balanceOf`.

## UI

- `src/components/ui.tsx`: Button, IconButton, Input, NumberInput, Textarea, Select, Field, Toggle, SearchInput,
  Card, PageHeader, Stat, Badge, Empty, Tabs, Money, Modal, and `useUi()` → `{ toast, confirm }`.
- `src/components/DateRange.tsx`: period picker + `resolveRange()`.
- `src/components/PrintPortal.tsx`: `printNode(node, 'A4' | 'A5' | '80mm' | '58mm')`.
- `src/lib/csv.ts`: `downloadCsv`, `parseCsv`. `src/lib/format.ts`: `fmtMoney`, `fmtNum`, `fmtQty`, `fmtDate`, `amountInWords`, `round2`.
- `src/lib/paths.ts`: route builders (`txnNewPath('sale', 'party=<id>')`, `txnPath`, `partyPath`, `itemPath`, ...).
- Styling: Tailwind. Neutrals are `stone-*`, brand is `brand-*` (teal), `bg-surface` for cards, `bg-page` for the page.
  Dark mode remaps the palette in CSS, so do NOT add `dark:` classes. Use logical properties (`ms-`, `me-`, `ps-`, `pe-`,
  `start-`, `end-`, `text-start`) so Urdu RTL works. Numbers get the `num` class. Tables use `.table-wrap` + `.tbl`
  (`.r` for right-aligned cells). Hide controls when printing with `no-print`.
- Money is shown with `<Money value={n} symbol={firm.currencySymbol} />` or `fmtMoney(n, firm.currencySymbol)`.

## i18n

`useI18n()` → `{ t, lang, dir }`. `t('key', { name: 'x' })`. Shared words are in `src/i18n/core.ts` (read it before
adding keys, reuse what exists). Each module has its own file in `src/i18n/` exporting `en` and `ur`. Every English
key needs an Urdu translation. Never use em dashes in any text.

## Routes (`src/App.tsx`)

`/` public landing page (`/home` redirects there), `/dashboard`, `/pos`, `/txns/:slug` list, `/txn/:slug/new` (query `party`, `from`, `against`), `/txn/:slug/:id` view,
`/txn/:slug/:id/edit`, `/items`, `/items/:id`, `/parties`, `/parties/:id`, `/cash-bank`, `/cash-bank/:id`,
`/reports`, `/reports/:key`, `/settings`, `/backup`, `/welcome`.

## Added in v2 (core)

- New transaction types: `capital_in`, `drawing` (owner money), `stock_transfer` (lines move from `godownId` to
  `toGodownId`, no accounting effect), `manufacture` (lines are materials used, `outputItemId` x `outputQty` is made,
  `charges` = making cost paid from `accountId`). `HAS_STATUS` lists the convertible documents.
- Split payments: `txn.payments: PaymentSplit[]` (account, mode, amount). Always read money through `moneySplits(t)`.
  `saveTxn` sets `received` to their sum. `txn.tendered` = cash handed over (receipt shows change).
- Cheques (payment_in / payment_out with `paymentMode: 'cheque'`): `chequeStatus` open / cleared / bounced, `chequeDate`,
  `clearedOn`. Open cheques sit in `cheques_in` / `cheques_out` until cleared; bounced ones have no effect.
  Use `setChequeStatus(db, t, status, clearedOn, accountId)`.
- Loan accounts: `Account.kind = 'loan'`; borrowing = transfer loan → bank, repaying = transfer bank → loan (+ an expense
  under "Loan interest"). `balanceSheet()` lists them under `loans`; also `chequesInHand`, `chequesIssued`, `capital`, `drawings`.
- Godowns: `data.godowns` (always includes `MAIN_GODOWN` = 'main'); `txn.godownId`, `adjustment.godownId`;
  `godownStock(items, txns, adjustments)` → item → godown → qty.
- Bill of materials: `item.bom: { itemId, qty }[]` (per 1 unit made).
- Recycle bin: `deleteTxn` moves to `db.bin`; `restoreTxn(db, id)`.
- Books closing: `settings.lockDate`; saves, cancels and deletes on or before it throw `errLocked`.
- Loyalty: `src/lib/loyalty.ts` (`pointsByParty`, `pointsAvailable`, `pointsValue`); `txn.pointsRedeemed` and the value goes
  into the bill discount. Settings: `features.loyalty`, `settings.loyalty { earnPer, pointValue }`.
- Access: `src/lib/access.tsx` → `useAccess()` `{ user, can(perm), lock }`, `AccessProvider`. Roles: owner, manager,
  accountant, cashier (`data.users`, PIN hash). Settings `appLock`, `autoLockMinutes`, `reminderTemplate`, `invoiceTheme`.

## v2 module notes

- Stock module: `src/components/stock/*` (godowns, transfers, BOM, manufacturing, catalogue). `/godowns?edit=<id>`,
  `/manufacturing?edit=<id>` and `?make=<itemId>` open the forms. `ScanButton` reads barcodes with the camera.
- Money module: `components/txn/payLogic.ts` (split payments), `components/cash/moneyLogic.ts` (loans), `txnErrorText`
  in `components/txn/logic.ts`. `TxnDocument` takes an optional `theme`. Loan interest expenses point to their loan with
  `toAccountId`. `AccountSelect` hides loan accounts unless `allowLoan`.
- Security: `src/lib/users.ts` (PIN hashing, `ROLE_PERMS`), `src/lib/access.tsx`, `components/security/*`
  (`RequirePerm`, `LockButton`, lock screen). Routes are guarded in `App.tsx`; report registry entries may set `perm`.
- Reminders: `settings.reminderTemplate` placeholders `{party} {amount} {firm} {phone} {due} {days}`.
- Auto backup: `src/lib/autobackup.ts` (File System Access API, folder handle in its own IndexedDB `saudagar-autobackup`).

## v3: accounts and cloud sync

- Backend: Supabase. `supabase/migrations/001_init.sql` (profiles, businesses, members, invites, records + RLS and RPCs),
  tested in PGlite by `tests/db/schema.test.ts`.
- `src/lib/supabase.ts` (client, `cloudConfigured`), `src/lib/auth.tsx` (`useAuth`: sign up / in / out, reset password),
  `src/lib/cloud.ts` (RPC wrappers, `supabaseRemote`, `refreshAccountBusinesses`), `src/lib/sync.ts` (pull by `rev`,
  push by row hash; tested in `tests/sync.test.ts`), `src/lib/syncProvider.tsx` (`useSync`: when to sync, status).
- `Firm.accountId` / `Firm.role`: which account the device copy belongs to and its role (drives `useAccess`).
  `FirmProvider` shows only the signed-in account's businesses; others are `unclaimed` (made before accounts).
- Firm DB v3 tables `syncHashes`, `syncMeta` (cursor, lastSync, registered, profileHash) are device-only, never synced or backed up.
- Routes: `/signin`, `/signup` (`?invite=CODE`), `/forgot-password`, `/reset-password`, `/welcome` (pick / create / join).
- Known limit: two devices creating documents offline at the same moment can get the same invoice number
  (both read the same counter). Remote changes win over unsent local edits to the same row.
