/**
 * Saudagar domain model.
 *
 * Every business ("firm") has its own IndexedDB database (see db.ts), so records
 * here carry no firm id. Money is stored as plain numbers rounded to 2 decimals.
 * Dates are local calendar dates as 'YYYY-MM-DD' strings.
 */

export type ID = string

// ---------- firm (business profile, kept in the meta database) ----------

export type BusinessType =
  | 'retail' | 'grocery' | 'wholesale' | 'distributor' | 'manufacturer' | 'pharmacy'
  | 'electronics' | 'garments' | 'hardware' | 'restaurant' | 'services' | 'agri' | 'other'

export interface Firm {
  id: ID
  name: string
  businessType: BusinessType
  ownerName?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  /** tax registration numbers (NTN / STRN in Pakistan, GSTIN elsewhere) */
  ntn?: string
  strn?: string
  /** logo as a data: URL */
  logo?: string
  currency: string
  currencySymbol: string
  createdAt: number
  /** the account (Supabase user id) this business belongs to on this device */
  accountId?: string
  /** this account's role in the business (from the cloud) */
  role?: Role
}

// ---------- per-firm settings ----------

export interface Features {
  /** charge tax on items and show tax on invoices */
  tax: boolean
  /** batch number + expiry on purchase and sale lines */
  batches: boolean
  /** serial / IMEI numbers on lines */
  serials: boolean
  /** second price list for wholesale customers */
  wholesale: boolean
  /** item sold in two units (e.g. box and piece) */
  altUnits: boolean
  /** discount on each line */
  lineDiscount: boolean
  /** delivery / packing charges on the invoice */
  charges: boolean
  /** round the invoice total to a whole number */
  roundOff: boolean
  /** quotations / estimates */
  estimates: boolean
  /** sale and purchase orders */
  orders: boolean
  /** delivery challans */
  challans: boolean
  /** due dates and payment terms on credit invoices */
  dueDates: boolean
  /** MRP (printed retail price) on items */
  mrp: boolean
  /** several godowns / warehouses / branches with stock transfer */
  godowns: boolean
  /** make finished goods from raw materials (bill of materials) */
  manufacturing: boolean
  /** loyalty points for customers */
  loyalty: boolean
}

export type InvoiceTheme = 'classic' | 'modern' | 'compact' | 'bold'

export interface LoyaltySettings {
  /** spend this much to earn 1 point */
  earnPer: number
  /** value of 1 point when redeemed */
  pointValue: number
}

export type PrintSize = 'a4' | 'a5' | 'thermal80' | 'thermal58'
export type NegativeStock = 'allow' | 'warn' | 'block'

export interface Settings {
  id: 'settings'
  features: Features
  /** label used on invoices: GST, Sales Tax, VAT */
  taxLabel: string
  defaultTaxRate: number
  /** tax rates offered in pickers */
  taxRates: number[]
  prefixes: Record<NumberedType, string>
  nextNo: Record<NumberedType, number>
  printSize: PrintSize
  /** accent colour of printed invoices */
  invoiceColor: string
  invoiceTerms?: string
  invoiceFooter?: string
  /** show the firm's signature line */
  signature: boolean
  negativeStock: NegativeStock
  /** payment terms in days for credit invoices */
  defaultDueDays: number
  /** default cash account for POS and quick sales */
  defaultAccountId?: ID
  /** POS: print the receipt right after saving */
  posAutoPrint: boolean
  /** entries on or before this date cannot be added, changed or deleted (books closed) */
  lockDate?: string
  invoiceTheme: InvoiceTheme
  loyalty: LoyaltySettings
  /** ask for a PIN when the app opens (see users) */
  appLock: boolean
  /** lock again after this many idle minutes (0 = only when the app opens) */
  autoLockMinutes: number
  /** WhatsApp payment reminder text; {party}, {amount}, {firm}, {phone} are filled in */
  reminderTemplate?: string
  /** POS: a cash shift must be open before selling */
  requireShift: boolean
  /** notes and coins counted when opening / closing a shift, largest first */
  denominations: number[]
  /** POS: open the cash drawer (through the receipt printer) on cash sales */
  drawerKick: boolean
}

// ---------- masters ----------

export type ItemKind = 'product' | 'service'

export interface Item {
  id: ID
  kind: ItemKind
  name: string
  /** short code / SKU, used for quick search */
  code?: string
  barcode?: string
  categoryId?: ID
  /** base unit, e.g. pcs, kg, ltr, box */
  unit: string
  /** optional second unit: 1 altUnit = altFactor base units (1 box = 12 pcs) */
  altUnit?: string
  altFactor?: number
  salePrice: number
  wholesalePrice?: number
  /** wholesale price applies from this quantity (0 = always for wholesale customers) */
  wholesaleMinQty?: number
  purchasePrice: number
  mrp?: number
  /** tax percent, 0 = exempt */
  taxRate: number
  /** prices above already include tax */
  priceIncludesTax: boolean
  openingStock: number
  /** cost per unit of the opening stock (defaults to purchase price) */
  openingCost?: number
  openingDate: string
  minStock?: number
  /** shelf / rack */
  location?: string
  hsn?: string
  description?: string
  /** bill of materials: what one unit of this item is made from */
  bom?: BomLine[]
  active: boolean
  createdAt: number
}

export interface BomLine {
  itemId: ID
  /** base units of the component per 1 unit made */
  qty: number
}

export interface Category {
  id: ID
  name: string
}

export type PartyKind = 'customer' | 'supplier' | 'both'
export type PriceTier = 'retail' | 'wholesale'

export interface Party {
  id: ID
  name: string
  kind: PartyKind
  phone?: string
  email?: string
  address?: string
  city?: string
  ntn?: string
  groupId?: ID
  /** positive = they owe us (receivable), negative = we owe them (payable) */
  openingBalance: number
  openingDate: string
  creditLimit?: number
  priceTier: PriceTier
  notes?: string
  active: boolean
  createdAt: number
}

export interface PartyGroup {
  id: ID
  name: string
}

/** loan accounts hold money borrowed (their balance is negative while owed) */
export type AccountKind = 'cash' | 'bank' | 'wallet' | 'loan'

/** where money is kept: cash in hand, bank accounts, mobile wallets (JazzCash, Easypaisa) */
export interface Account {
  id: ID
  kind: AccountKind
  name: string
  bankName?: string
  accountNo?: string
  openingBalance: number
  openingDate: string
  active: boolean
  createdAt: number
}

export type MoneyCategoryKind = 'expense' | 'income'

/** expense heads (rent, salary, electricity) and other income heads */
export interface MoneyCategory {
  id: ID
  kind: MoneyCategoryKind
  name: string
}

// ---------- transactions ----------

export type TxnType =
  // sales side
  | 'sale' | 'sale_return' | 'estimate' | 'sale_order' | 'delivery_challan'
  // purchase side
  | 'purchase' | 'purchase_return' | 'purchase_order'
  // money
  | 'payment_in' | 'payment_out' | 'expense' | 'other_income' | 'transfer'
  // owner's money: capital put in, drawings taken out
  | 'capital_in' | 'drawing'
  // stock: move between godowns, make goods from raw materials
  | 'stock_transfer' | 'manufacture'

/** types that get an automatic running number */
export type NumberedType = TxnType

export type PaymentMode = 'cash' | 'bank' | 'cheque' | 'card' | 'wallet' | 'online'

export interface TxnLine {
  /** empty for free-text lines (expense heads, one-off items) */
  itemId?: ID
  name: string
  description?: string
  qty: number
  /** unit shown on the line; may be the item's altUnit */
  unit: string
  /** base units per 1 line unit (1 for the base unit, altFactor for the alt unit) */
  factor: number
  /** price per line unit, as entered (may include tax, see priceIncludesTax) */
  rate: number
  priceIncludesTax: boolean
  discountPct: number
  /** line discount amount */
  discount: number
  taxRate: number
  taxAmount: number
  /** line total including tax, after line discount */
  amount: number
  batch?: string
  expiry?: string
  serial?: string
  mrp?: number
}

export type TxnStatus = 'open' | 'converted' | 'cancelled'

/** one part of a bill paid in several ways (part cash, part card) */
export interface PaymentSplit {
  accountId: ID
  mode: PaymentMode
  amount: number
  refNo?: string
}

/** cheques stay "in hand" until cleared; bounced cheques have no effect */
export type ChequeStatus = 'open' | 'cleared' | 'bounced'

export interface Txn {
  id: ID
  type: TxnType
  /** printed number, e.g. INV-0012 */
  number: string
  date: string
  /** time the record was created, used to order transactions on the same date */
  createdAt: number
  updatedAt: number

  partyId?: ID
  /** name for walk-in customers or one-off parties */
  partyName?: string
  partyPhone?: string

  lines: TxnLine[]
  /** sum of line amounts (after line discounts, including line tax) */
  subtotal: number
  /** whole-invoice discount */
  discountPct: number
  discount: number
  taxTotal: number
  /** delivery / packing / other charges */
  charges: number
  roundOff: number
  /** grand total. For payment / expense / income / transfer: the amount */
  total: number

  /** paid now (sale, purchase, returns, expense). Equals total for payments */
  received: number
  /** split payment; when set, received = sum of amounts and accountId is ignored */
  payments?: PaymentSplit[]
  /** cash handed over by the customer (receipt shows the change) */
  tendered?: number
  accountId?: ID
  /** transfers only: destination account */
  toAccountId?: ID
  paymentMode?: PaymentMode
  /** cheque no, bank ref, supplier bill no */
  refNo?: string
  /** payment in / out by cheque: date on the cheque and its state */
  chequeDate?: string
  chequeStatus?: ChequeStatus
  /** date the cheque cleared into accountId */
  clearedOn?: string
  dueDate?: string

  /** estimates, orders and challans: open until converted to an invoice */
  status?: TxnStatus
  /** the estimate / order / challan this was converted from */
  sourceId?: ID
  /** returns: the original invoice */
  againstId?: ID

  /** expense or other-income head */
  categoryId?: ID
  /** shipping / delivery address shown on the invoice */
  shipTo?: string
  notes?: string
  /** cancelled invoices keep their number but have no effect */
  cancelled?: boolean
  /** created from the POS screen */
  pos?: boolean
  /** godown the stock leaves from / arrives at (empty = main godown) */
  godownId?: ID
  /** stock transfers: destination godown */
  toGodownId?: ID
  /** manufacture: the finished item and quantity made (lines are the materials used) */
  outputItemId?: ID
  outputQty?: number
  /** loyalty points the customer spent on this bill (their value is in the discount) */
  pointsRedeemed?: number
  /** cash shift this bill was rung up in (POS) */
  shiftId?: ID
}

export type AdjustmentReason = 'count' | 'damage' | 'expired' | 'gift' | 'own_use' | 'production' | 'other'

/** manual stock change (count correction, damage, consumption) */
export interface StockAdjustment {
  id: ID
  itemId: ID
  date: string
  /** + adds stock, - removes stock (base units) */
  qty: number
  reason: AdjustmentReason
  godownId?: ID
  batch?: string
  note?: string
  createdAt: number
}

// ---------- cash shifts (cash drawer sessions) ----------

/** count of each note / coin, e.g. { 5000: 2, 1000: 7, 10: 3 } */
export type Denoms = Record<string, number>

export type CashMoveType = 'pay_in' | 'pay_out' | 'drop' | 'no_sale'

/** cash put into or taken out of the drawer during a shift (each also posts a transaction) */
export interface CashMove {
  id: ID
  at: number
  type: CashMoveType
  amount: number
  reason?: string
  by: string
  /** the transaction that records it in the books (none for no-sale) */
  txnId?: ID
}

export interface Shift {
  id: ID
  /** SH-0001 */
  number: string
  /** this device's drawer name, e.g. "Counter 1" */
  register: string
  /** device that opened it (only that device continues the shift) */
  deviceId: string
  /** cash account of the drawer */
  accountId: ID
  status: 'open' | 'closed'
  openedAt: number
  openedBy: string
  openingFloat: number
  openingCount?: Denoms
  /** drawer account balance in the books when the shift opened */
  bookAtOpen: number
  moves: CashMove[]
  closedAt?: number
  closedBy?: string
  countedCash?: number
  closingCount?: Denoms
  expectedCash?: number
  /** counted - expected: + over, - short */
  difference?: number
  /** transactions posted for an opening or closing over / short */
  adjustTxnIds?: ID[]
  notes?: string
}

export interface Godown {
  id: ID
  name: string
  address?: string
  active: boolean
  createdAt: number
}

export type Role = 'owner' | 'manager' | 'accountant' | 'cashier'

/** people who use the app on this device, each with a PIN */
export interface AppUser {
  id: ID
  name: string
  role: Role
  /** SHA-256 of the PIN (see lib/users.ts) */
  pinHash: string
  active: boolean
  createdAt: number
}

/** a deleted transaction, kept so it can be restored */
export interface BinEntry {
  id: ID
  deletedAt: number
  txn: Txn
}

/** change history kept for every save / delete */
export interface AuditEntry {
  id?: number
  at: number
  action: 'create' | 'update' | 'delete' | 'cancel' | 'restore'
  entity: 'txn' | 'item' | 'party' | 'account' | 'adjustment' | 'settings' | 'godown' | 'user'
  entityId: ID
  summary: string
}
