import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as core from '../i18n/core'
import * as txn from '../i18n/txn'
import * as pos from '../i18n/pos'
import * as items from '../i18n/items'
import * as parties from '../i18n/parties'
import * as reports from '../i18n/reports'
import * as landing from '../i18n/landing'
import * as stock from '../i18n/stock'
import * as money from '../i18n/money'
import * as business from '../i18n/business'
import * as auth from '../i18n/auth'
import * as shift from '../i18n/shift'

export type Lang = 'en' | 'ur'
type Vars = Record<string, string | number>

const parts = [core, txn, pos, items, parties, reports, landing, stock, money, business, auth, shift]
const EN: Record<string, string> = Object.assign({}, ...parts.map((p) => p.en))
const UR: Record<string, string> = Object.assign({}, ...parts.map((p) => p.ur))

interface I18nCtx {
  lang: Lang
  setLang: (l: Lang) => void
  /** translate a key; {name} placeholders are filled from vars. Falls back to English, then the key. */
  t: (key: string, vars?: Vars) => string
  dir: 'ltr' | 'rtl'
}

const Ctx = createContext<I18nCtx | null>(null)
const KEY = 'saudagar.lang'

export function translate(lang: Lang, key: string, vars?: Vars) {
  let s = (lang === 'ur' ? UR[key] : undefined) ?? EN[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return localStorage.getItem(KEY) === 'ur' ? 'ur' : 'en' } catch { return 'en' }
  })
  const dir = lang === 'ur' ? 'rtl' : 'ltr'
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(KEY, l) } catch { /* private mode */ }
  }, [])
  const t = useCallback((key: string, vars?: Vars) => translate(lang, key, vars), [lang])
  const value = useMemo(() => ({ lang, setLang, t, dir: dir as 'ltr' | 'rtl' }), [lang, setLang, t, dir])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useI18n outside I18nProvider')
  return c
}
