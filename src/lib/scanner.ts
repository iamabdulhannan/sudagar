import { useEffect, useRef } from 'react'
import type { Item } from './types'

/**
 * USB and Bluetooth barcode scanners act as a keyboard: they type the code very fast and press
 * Enter (some send Tab). A person types far slower, so a burst of keys with tiny gaps that ends in
 * Enter is a scan. This works wherever the cursor is: the digits that landed in a field are taken
 * back out, and the code is handed to `onScan` instead.
 */

/** fastest a person types between two keys; scanners are 5-30 ms */
const MAX_GAP_MS = 45
const MIN_LENGTH = 4

export interface ScanBuffer { chars: string; first: number; last: number; fast: boolean }

/** feed one key; returns the finished code when Enter / Tab ends a scan, else null */
export function feedKey(buf: ScanBuffer, key: string, now: number): { buf: ScanBuffer; code: string | null } {
  if (key === 'Enter' || key === 'Tab') {
    const code = buf.chars.length >= MIN_LENGTH && buf.fast && now - buf.last <= MAX_GAP_MS * 2 ? buf.chars : null
    return { buf: { chars: '', first: 0, last: 0, fast: true }, code }
  }
  if (key.length !== 1) return { buf, code: null }
  if (!buf.chars || now - buf.last > MAX_GAP_MS) return { buf: { chars: key, first: now, last: now, fast: true }, code: null }
  return { buf: { ...buf, chars: buf.chars + key, last: now }, code: null }
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, v: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * Listen for scans while the component is mounted.
 * Scans are ignored while a dialog is open (payment, item form ...) unless `inDialogs` is set.
 */
export function useBarcodeScanner(onScan: (code: string) => void, opts: { enabled?: boolean; inDialogs?: boolean } = {}) {
  const { enabled = true, inDialogs = false } = opts
  const cb = useRef(onScan)
  cb.current = onScan
  useEffect(() => {
    if (!enabled) return
    let buf: ScanBuffer = { chars: '', first: 0, last: 0, fast: true }
    // what the focused field held before the burst started, to put it back after a scan
    let before: { el: HTMLInputElement | HTMLTextAreaElement; value: string } | null = null
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return
      if (!inDialogs && document.querySelector('[role="dialog"]')) return
      const now = e.timeStamp || performance.now()
      const starting = !buf.chars || now - buf.last > MAX_GAP_MS
      if (starting && e.key.length === 1) {
        const el = document.activeElement
        before = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? { el, value: el.value } : null
      }
      const r = feedKey(buf, e.key, now)
      buf = r.buf
      if (r.code) {
        e.preventDefault()
        e.stopPropagation()
        if (before && before.el.value !== before.value) setNativeValue(before.el, before.value)
        before = null
        cb.current(r.code)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [enabled, inDialogs])
}

// ---------- what a scanned code means ----------

const norm = (s?: string) => (s ?? '').trim().toLowerCase()

/** EAN-13 check digit is right */
export function validEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false
  const d = code.split('').map(Number)
  const sum = d.slice(0, 12).reduce((a, n, i) => a + n * (i % 2 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === d[12]
}

/**
 * Weighing-scale labels: 13 digits starting with 2, then a 5-digit item number (PLU), a 5-digit
 * weight in grams and a check digit, e.g. 2 1 00042 01250 7 = item 00042, 1.250 kg.
 */
export function parseScaleBarcode(code: string): { plu: string; grams: number } | null {
  if (!/^2\d{12}$/.test(code) || !validEan13(code)) return null
  return { plu: code.slice(2, 7), grams: Number(code.slice(7, 12)) }
}

/** find the item for a scanned code: barcode, then item code, then a scale label */
export function scanLookup(items: Item[], raw: string): { item: Item; qty?: number } | null {
  const code = raw.trim()
  const s = norm(code)
  if (!s) return null
  const hit = items.find((i) => norm(i.barcode) === s) ?? items.find((i) => norm(i.code) === s)
  if (hit) return { item: hit }
  const scale = parseScaleBarcode(code)
  if (scale) {
    const plu = scale.plu.replace(/^0+/, '')
    const item = items.find((i) => [i.code, i.barcode].some((c) => c && (c === scale.plu || c.replace(/^0+/, '') === plu)))
    if (item) return { item, qty: item.unit === 'g' ? scale.grams : scale.grams / 1000 }
  }
  return null
}
