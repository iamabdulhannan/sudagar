import { ScanBarcode, ShoppingCart, Warehouse } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { printTxn } from '../components/print/printTxn'
import { exactCodeMatch, fmtStock, searchItems } from '../components/items/itemUtils'
import { scanLookup, useBarcodeScanner } from '../lib/scanner'
import { NeedShift, ShiftControl } from '../components/shift/ShiftControl'
import { openDrawer } from '../lib/drawer'
import { openShiftOf } from '../lib/shift'
import { ScanButton } from '../components/items/ScanButton'
import { CartPanel, type CartActions } from '../components/pos/CartPanel'
import { ItemGrid } from '../components/pos/ItemGrid'
import { PaymentModal, type PaymentResult } from '../components/pos/PaymentModal'
import { HeldBillsModal, PosHeader, SaleDone, ShortcutLegend } from '../components/pos/PosParts'
import {
  cartLine, cartQty, draftToTxn, loadHeld, loadLastSale, loadPosGodown, maxRedeemable, newDraft, refresh, saveHeld, saveLastSale, savePosGodown,
  type CartLine, type HeldBill, type PosDraft,
} from '../components/pos/cart'
import { useStockIn } from '../components/stock/useStock'
import { fieldCls, useUi, Select } from '../components/ui'
import { cx } from '../lib/cx'
import { useData } from '../lib/data'
import { MAIN_GODOWN, today } from '../lib/db'
import { fmtMoney, round3 } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { pointsAvailable } from '../lib/loyalty'
import { saveTxn, TxnError } from '../lib/txn'
import type { ID, Item, Txn } from '../lib/types'

const GRID_LIMIT = 120

/** is a dialog (modal, confirm) open? Shortcuts then belong to it. */
const dialogOpen = () => !!document.querySelector('[role="dialog"]')
/** desktop with a mouse: keep the search box focused (on phones that would pop the keyboard) */
const finePointer = () => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches

/** full-screen counter billing */
export default function Pos() {
  const data = useData()
  const { db, firm, items, categories, settings, itemById, partyById, txnById, txns, godowns } = data
  // the cash shift open on this device; with "open a shift before selling" on, selling waits for one
  const shift = openShiftOf(data.shifts)
  const needShift = !!settings.requireShift && !shift
  const { t } = useI18n()
  const { toast, confirm } = useUi()
  const sym = firm.currencySymbol
  const f = settings.features

  const [draft, setDraft] = useState<PosDraft>(newDraft)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<ID | ''>('')
  const [held, setHeld] = useState<HeldBill[]>(() => loadHeld(firm.id))
  const [lastId, setLastId] = useState<ID | null>(() => loadLastSale(firm.id))
  const [showHeld, setShowHeld] = useState(false)
  const [paying, setPaying] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<{ txn: Txn; change: number } | null>(null)
  const [sheet, setSheet] = useState(false)
  // the counter's godown is remembered on this device
  const [godown, setGodownState] = useState<ID>(() => {
    const g = loadPosGodown(firm.id)
    return g && godowns.some((x) => x.id === g && x.active) ? g : MAIN_GODOWN
  })
  const setGodown = (g: ID) => { setGodownState(g); savePosGodown(firm.id, g) }
  /** stock per item in the counter's godown (or in total when godowns are off) */
  const qty = useStockIn(f.godowns ? godown : undefined)

  const searchRef = useRef<HTMLInputElement>(null)
  const customerRef = useRef<HTMLDivElement>(null)
  const discountRef = useRef<HTMLDivElement>(null)
  const warned = useRef(new Set<ID>())

  const party = draft.partyId ? partyById.get(draft.partyId) : undefined
  const points = useMemo(
    () => (f.loyalty && draft.partyId ? pointsAvailable(txns, settings, draft.partyId) : 0),
    [f.loyalty, draft.partyId, txns, settings],
  )
  const txn = useMemo(() => draftToTxn(draft, settings, points), [draft, settings, points])
  const maxPoints = useMemo(() => {
    if (!points) return 0
    const base = draftToTxn({ ...draft, pointsRedeemed: 0 }, settings)
    return maxRedeemable(points, base.subtotal - base.discount + base.charges, settings.loyalty.pointValue)
  }, [draft, settings, points])
  const lastSale = lastId ? txnById.get(lastId) : undefined

  const focusSearch = useCallback(() => { if (finePointer()) searchRef.current?.focus() }, [])
  useEffect(() => { focusSearch() }, [focusSearch])

  // ---------- item list ----------

  const sellable = useMemo(() => items.filter((i) => i.active), [items])
  const usedCats = useMemo(() => {
    const ids = new Set(sellable.map((i) => i.categoryId).filter(Boolean))
    return categories.filter((c) => ids.has(c.id))
  }, [sellable, categories])
  const shown = useMemo(() => {
    const list = cat ? sellable.filter((i) => i.categoryId === cat) : sellable
    return searchItems(list, query, GRID_LIMIT)
  }, [sellable, cat, query])
  const inCart = useMemo(() => {
    const m = new Map<ID, number>()
    for (const l of draft.lines) if (l.itemId) m.set(l.itemId, round3((m.get(l.itemId) ?? 0) + l.qty * (l.factor || 1)))
    return m
  }, [draft.lines])

  /** line keys whose item has less stock than the bill needs */
  const over = useMemo(() => {
    const s = new Set<string>()
    for (const l of draft.lines) {
      const item = l.itemId ? itemById.get(l.itemId) : undefined
      if (item?.kind === 'product' && (inCart.get(item.id) ?? 0) > (qty.get(item.id) ?? 0)) s.add(l.key)
    }
    return s
  }, [draft.lines, inCart, itemById, qty])

  // ---------- stock rule ----------

  /** may the bill hold `total` base units of the item? Blocks or warns per settings.negativeStock */
  const stockOk = useCallback((item: Item, total: number): boolean => {
    if (item.kind !== 'product' || settings.negativeStock === 'allow') return true
    const have = qty.get(item.id) ?? 0
    if (total <= have) return true
    const msg = t('errNegativeStock', { name: item.name, qty: fmtStock(item, have, f.altUnits) })
    if (settings.negativeStock === 'block') { toast(msg, 'error'); return false }
    if (!warned.current.has(item.id)) { warned.current.add(item.id); toast(msg, 'info') }
    return true
  }, [settings.negativeStock, qty, t, toast, f.altUnits])

  // ---------- cart actions ----------

  const updateLine = useCallback((key: string, patch: (l: CartLine) => Partial<CartLine>) => {
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l) => {
        if (l.key !== key) return l
        const item = l.itemId ? itemById.get(l.itemId) : undefined
        return refresh({ ...l, ...patch(l) }, item, d.partyId ? partyById.get(d.partyId) : undefined, settings)
      }),
    }))
  }, [itemById, partyById, settings])

  const addItem = useCallback((item: Item, qty = 1) => {
    const existing = draft.lines.find((l) => l.itemId === item.id && l.factor === 1)
    if (!stockOk(item, cartQty(draft.lines, item.id) + qty)) return
    if (existing) updateLine(existing.key, (l) => ({ qty: round3(l.qty + qty) }))
    else setDraft((d) => {
      const line = cartLine(item, d.partyId ? partyById.get(d.partyId) : undefined, settings)
      return { ...d, lines: [...d.lines, qty === 1 ? line : { ...line, qty: round3(qty) }] }
    })
  }, [draft.lines, stockOk, updateLine, partyById, settings])

  const lineItem = (key: string) => {
    const l = draft.lines.find((x) => x.key === key)
    return { l, item: l?.itemId ? itemById.get(l.itemId) : undefined }
  }

  const actions: CartActions = {
    setQty: (key, q) => {
      const { l, item } = lineItem(key)
      if (!l) return
      if (item && q > l.qty && !stockOk(item, cartQty(draft.lines, item.id, key) + q * (l.factor || 1))) return
      updateLine(key, () => ({ qty: Math.max(0, q) }))
    },
    step: (key, by) => {
      const { l, item } = lineItem(key)
      if (!l) return
      const q = round3(Math.max(1, l.qty + by))
      if (by > 0 && item && !stockOk(item, cartQty(draft.lines, item.id, key) + q * (l.factor || 1))) return
      updateLine(key, () => ({ qty: q }))
    },
    setUnit: (key, alt) => {
      const { l, item } = lineItem(key)
      if (!l || !item?.altUnit || !item.altFactor) return
      const factor = alt ? item.altFactor : 1
      if (alt && !stockOk(item, cartQty(draft.lines, item.id, key) + l.qty * factor)) return
      updateLine(key, (x) => ({
        factor, unit: alt ? item.altUnit! : item.unit,
        // a typed rate is per unit, so convert it with the unit
        rate: x.manualRate ? x.rate * (factor / (x.factor || 1)) : x.rate,
      }))
    },
    setRate: (key, rate) => updateLine(key, () => ({ rate: Math.max(0, rate), manualRate: true })),
    setLineDiscount: (key, pct) => updateLine(key, () => ({ discountPct: Math.min(100, Math.max(0, pct)), discount: 0 })),
    remove: (key) => setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.key !== key) })),
    setParty: (id) => setDraft((d) => {
      const p = id ? partyById.get(id) : undefined
      return { ...d, partyId: id, pointsRedeemed: 0, lines: d.lines.map((l) => refresh(l, l.itemId ? itemById.get(l.itemId) : undefined, p, settings)) }
    }),
    setPoints: (n) => setDraft((d) => ({ ...d, pointsRedeemed: Math.max(0, Math.floor(n)) })),
    setDiscount: (mode, value) => setDraft((d) => ({
      ...d, discountMode: mode,
      discountPct: mode === 'pct' ? Math.min(100, Math.max(0, value)) : 0,
      discount: mode === 'amt' ? Math.max(0, value) : 0,
    })),
    hold: () => hold(),
    clear: () => { clear() },
    pay: () => pay(),
  }

  // ---------- bills ----------

  const reset = useCallback(() => {
    setDraft(newDraft())
    setQuery('')
    setSheet(false)
    warned.current.clear()
    setTimeout(focusSearch, 0)
  }, [focusSearch])

  const storeHeld = (list: HeldBill[]) => { setHeld(list); saveHeld(firm.id, list) }
  const asHeld = (d: PosDraft): HeldBill => ({
    id: d.id, at: Date.now(), draft: d, total: draftToTxn(d, settings).total,
    label: d.partyId ? partyById.get(d.partyId)?.name ?? '' : '',
  })

  function hold() {
    if (!draft.lines.length) return
    storeHeld([asHeld(draft), ...held.filter((b) => b.id !== draft.id)])
    toast(t('posHeld'))
    reset()
  }

  function resume(b: HeldBill) {
    const rest = held.filter((x) => x.id !== b.id)
    // the bill on screen goes on hold so nothing is lost
    storeHeld(draft.lines.length ? [asHeld(draft), ...rest] : rest)
    setDraft({ ...b.draft, lines: b.draft.lines.map((l) => refresh(l, l.itemId ? itemById.get(l.itemId) : undefined, b.draft.partyId ? partyById.get(b.draft.partyId) : undefined, settings)) })
    setShowHeld(false)
    warned.current.clear()
    setTimeout(focusSearch, 0)
  }

  async function discard(b: HeldBill) {
    if (!(await confirm({ title: t('posDiscardHeld'), text: t('cannotUndo'), danger: true, okLabel: t('delete') }))) return
    storeHeld(held.filter((x) => x.id !== b.id))
  }

  async function clear() {
    if (!draft.lines.length && !draft.partyId) return
    if (!(await confirm({ title: t('posClearTitle'), text: t('posClearText'), danger: true, okLabel: t('posClear') }))) return
    reset()
  }

  function pay() {
    if (needShift) return
    if (!draft.lines.length) { toast(t('errNoLines'), 'error'); return }
    if (draft.lines.some((l) => !(l.qty > 0))) { toast(t('errBadLine'), 'error'); return }
    if (txn.total <= 0 && !draft.partyId) {
      // nothing to collect (free items): save straight away
      void finish({ received: 0, paymentMode: 'cash', change: 0 })
      return
    }
    setPaying(true)
  }

  async function finish(p: PaymentResult) {
    setSaving(true)
    try {
      const saved = await saveTxn(db, {
        ...txn, date: today(), received: p.received, accountId: p.accountId, paymentMode: p.paymentMode, pos: true,
        payments: p.payments, tendered: p.tendered, shiftId: shift?.id,
        godownId: f.godowns && godown !== MAIN_GODOWN ? godown : undefined,
      })
      // cash went into the drawer: open it (when a printer port is set up)
      if (settings.drawerKick && (p.payments?.some((x) => x.mode === 'cash' && x.amount > 0) || (!p.payments?.length && p.paymentMode === 'cash' && p.received > 0))) void openDrawer().catch(() => false)
      saveLastSale(firm.id, saved.id)
      setLastId(saved.id)
      if (held.some((b) => b.id === saved.id)) storeHeld(held.filter((b) => b.id !== saved.id))
      setPaying(false)
      if (settings.posAutoPrint) {
        printTxn(data, saved, 'thermal80')
        toast(p.change > 0 ? t('posSavedChange', { no: saved.number, amount: fmtMoney(p.change, sym) }) : t('posSavedNo', { no: saved.number }))
        reset()
      } else {
        setDone({ txn: saved, change: p.change })
      }
    } catch (err) {
      if (err instanceof TxnError) toast(t(err.problem.key, err.problem.vars), 'error')
      else toast(t('somethingWrong'), 'error')
    } finally {
      setSaving(false)
    }
  }

  // ---------- search box ----------

  function onSearchKey(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      const q = query.trim()
      if (!q) return
      // a scanner types the code then Enter: exact barcode / code first
      const hit = exactCodeMatch(sellable, q) ?? (shown.length ? shown[0] : undefined)
      if (hit) { addItem(hit); setQuery('') }
      else toast(t('posNotFound', { q }), 'error')
    } else if (e.key === 'Escape' && query) {
      e.preventDefault()
      e.stopPropagation()
      setQuery('')
    }
  }

  const onTile = useCallback((item: Item) => { addItem(item); focusSearch() }, [addItem, focusSearch])

  /** a code from the barcode scanner (anywhere on the screen) or the camera: add the item */
  const onScan = (code: string) => {
    const hit = scanLookup(sellable, code)
    if (hit) addItem(hit.item, hit.qty)
    else toast(t('posNotFound', { q: code }), 'error')
    setTimeout(focusSearch, 0)
  }
  useBarcodeScanner(onScan, { enabled: !paying && !needShift })

  // ---------- shortcuts ----------

  const keys = useRef({ hold, pay, clear })
  keys.current = { hold, pay, clear }
  useEffect(() => {
    const focusIn = (el: HTMLElement | null) => el?.querySelector<HTMLElement>('input, button, select, [tabindex]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (dialogOpen()) return
      const k = e.key
      if (k === 'F2') { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select() }
      else if (k === 'F4') { e.preventDefault(); setSheet(true); setTimeout(() => focusIn(customerRef.current), 0) }
      else if (k === 'F7') {
        e.preventDefault(); setSheet(true)
        setTimeout(() => discountRef.current?.querySelector('input')?.select(), 0)
      }
      else if (k === 'F8') { e.preventDefault(); keys.current.hold() }
      else if (k === 'F9' || (k === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); keys.current.pay() }
      else if (k === 'Escape') { e.preventDefault(); void keys.current.clear() }
      else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // typing anywhere (or a scanner) goes to the search box
        const el = document.activeElement as HTMLElement | null
        const tag = el?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && !el?.isContentEditable) searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const lineCount = draft.lines.length

  return (
    <div className="flex h-dvh flex-col bg-page">
      {needShift && <NeedShift />}
      <PosHeader
        heldCount={held.length}
        onHeld={() => setShowHeld(true)}
        lastSale={lastSale}
        onReprint={() => lastSale && printTxn(data, lastSale, 'thermal80')}
        extra={<><ShiftControl shift={shift} />{f.godowns && (
          <label className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-white/80 hover:bg-white/10" title={t('posGodown')}>
            <Warehouse className="size-4 shrink-0" />
            <Select
              value={godown}
              onChange={(e) => setGodown(e.target.value)}
              className="h-8 w-auto max-w-36 border-white/20! bg-white/10! px-2 font-medium text-white! sm:max-w-48"
              aria-label={t('posGodown')}
            >
              {godowns.filter((g) => g.active || g.id === godown).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </label>
        )}</>}
      />

      <div className="flex min-h-0 flex-1">
        {/* left: search, categories, item tiles */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="space-y-2 border-b border-stone-200 bg-surface p-3">
            <div className="relative">
              <ScanBarcode className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder={t('posSearchPh')}
                className={cx(fieldCls, 'h-12 ps-11 pe-14 text-base lg:pe-24')}
                autoComplete="off"
                spellCheck={false}
                aria-label={t('posSearchPh')}
              />
              <div className="absolute end-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                <kbd className="num pointer-events-none hidden rounded border border-stone-300 px-1.5 text-[11px] text-stone-500 lg:block">F2</kbd>
                <ScanButton onCode={onScan} size="lg" />
              </div>
            </div>
            {usedCats.length > 0 && (
              <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5">
                <Chip active={!cat} onClick={() => setCat('')}>{t('all')}</Chip>
                {usedCats.map((c) => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(cat === c.id ? '' : c.id)}>{c.name}</Chip>)}
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-24 lg:pb-3">
            <ItemGrid items={shown} qty={qty} inCart={inCart} sym={sym} altUnits={f.altUnits} onAdd={onTile} />
            {shown.length >= GRID_LIMIT && (
              <p className="num mt-3 text-center text-xs text-stone-500">{t('itShowing', { n: shown.length, total: cat ? sellable.filter((i) => i.categoryId === cat).length : sellable.length })}</p>
            )}
          </div>
          <ShortcutLegend />
        </section>

        {/* right: the bill. On phones it is a bottom sheet. */}
        {sheet && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSheet(false)} />}
        <aside
          className={cx(
            'flex-col border-stone-200 bg-surface lg:static lg:z-auto lg:flex lg:h-auto lg:w-[420px] lg:max-w-none lg:rounded-none lg:border-s lg:shadow-none xl:w-[460px]',
            sheet ? 'fixed inset-x-0 bottom-0 z-40 flex h-[88dvh] rounded-t-2xl shadow-2xl' : 'hidden',
          )}
        >
          <CartPanel
            draft={draft}
            txn={txn}
            loyalty={f.loyalty && draft.partyId ? { available: points, max: maxPoints } : undefined}
            over={over}
            actions={actions}
            customerRef={customerRef}
            discountRef={discountRef}
            onCloseSheet={() => setSheet(false)}
          />
        </aside>
      </div>

      {/* phones: sticky total bar */}
      {!sheet && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-2 border-t border-stone-200 bg-surface p-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] lg:hidden">
          <button type="button" onClick={() => setSheet(true)} className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1 text-start cursor-pointer">
            <span className="relative">
              <ShoppingCart className="size-6 text-stone-700" />
              {lineCount > 0 && <span className="num absolute -top-1.5 -end-2 rounded-full bg-brand-700 px-1 text-[10px] font-bold text-white">{lineCount}</span>}
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] text-stone-500">{t('posViewBill')}</span>
              <span className="num block text-lg font-extrabold text-stone-900">{fmtMoney(txn.total, sym)}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={pay}
            disabled={!lineCount}
            className="h-12 rounded-xl bg-emerald-600 px-6 text-base font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
          >
            {t('posPay')}
          </button>
        </div>
      )}

      <PaymentModal open={paying} onClose={() => setPaying(false)} total={txn.total} party={party} saving={saving} onConfirm={finish} />
      <HeldBillsModal open={showHeld} onClose={() => setShowHeld(false)} bills={held} onResume={resume} onDiscard={discard} />
      <SaleDone
        txn={done?.txn ?? null}
        change={done?.change ?? 0}
        onPrint={() => done && printTxn(data, done.txn, 'thermal80')}
        onNew={() => { setDone(null); reset() }}
      />
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'shrink-0 rounded-full border px-3 py-1 text-sm font-medium whitespace-nowrap cursor-pointer',
        active ? 'border-brand-700 bg-brand-700 text-white' : 'border-stone-300 bg-surface text-stone-700 hover:bg-stone-100',
      )}
    >
      {children}
    </button>
  )
}
