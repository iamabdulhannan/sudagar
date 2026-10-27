import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { fmtDate, fmtMoney } from '../../lib/format'
import type { DayTotals } from '../../lib/reports'

/**
 * Daily sales vs purchases as grouped columns, drawn by hand in SVG (no chart library).
 * Colours come from Tailwind fill classes (brand-600 and amber-600 read well on both the
 * light and the dark surface); text uses the stone text tokens so it follows the theme.
 * Hovering a day shows a tooltip; a hidden table carries the numbers for screen readers.
 */

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

/** 0 and 3 to 5 clean steps above the max */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1]
  const raw = max / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v)
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step)
  return out
}

/** column with a 4px rounded top and a square base */
function colPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return ''
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

export interface ChartLabels {
  title: string
  desc: string
  sales: string
  purchases: string
  date: string
}

export function SalesChart({ days, symbol, labels }: { days: DayTotals[]; symbol: string; labels: ChartLabels }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)
  const id = useId()

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const height = 220
  const pad = { top: 12, right: 8, bottom: 26, left: 44 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const max = useMemo(() => Math.max(0, ...days.map((d) => Math.max(d.sales, d.purchases))), [days])
  const ticks = useMemo(() => niceTicks(max), [max])
  const top = ticks[ticks.length - 1] || 1
  const band = plotW / Math.max(days.length, 1)
  const barW = Math.max(2, Math.min(12, (band - 4) / 2 - 1))
  const y = (v: number) => pad.top + plotH - (v / top) * plotH
  const labelEvery = width < 420 ? 10 : width < 640 ? 7 : 5
  const h = hover !== null ? days[hover] : null
  const tipLeft = hover !== null ? Math.min(Math.max(pad.left + band * hover + band / 2, 90), width - 90) : 0

  return (
    <div ref={wrap} dir="ltr" className="relative w-full select-none" onMouseLeave={() => setHover(null)}>
      <svg width={width} height={height} role="img" aria-labelledby={`${id}-t ${id}-d`} className="block text-stone-500">
        <title id={`${id}-t`}>{labels.title}</title>
        <desc id={`${id}-d`}>{labels.desc}</desc>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} className="stroke-stone-200" strokeWidth={1} shapeRendering="crispEdges" />
            <text x={pad.left - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="currentColor" className="num">{compact.format(v)}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x0 = pad.left + band * i
          const cx = x0 + band / 2
          return (
            <g key={d.date}>
              {hover === i && <rect x={x0} y={pad.top} width={band} height={plotH} className="fill-stone-100" />}
              <path d={colPath(cx - barW - 1, y(d.sales), barW, y(0) - y(d.sales))} className="fill-brand-600" />
              <path d={colPath(cx + 1, y(d.purchases), barW, y(0) - y(d.purchases))} className="fill-amber-600" />
              {(i % labelEvery === 0 || i === days.length - 1) && (
                <text x={cx} y={height - 8} textAnchor="middle" fontSize={11} fill="currentColor" className="num">{fmtDate(d.date).replace(/ \d{4}$/, '')}</text>
              )}
              {/* hit target: the whole day band */}
              <rect x={x0} y={pad.top} width={band} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
            </g>
          )
        })}
        <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} className="stroke-stone-300" strokeWidth={1} shapeRendering="crispEdges" />
      </svg>

      {h && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-44 -translate-x-1/2 rounded-lg border border-stone-200 bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: tipLeft }}
          role="status"
        >
          <div className="mb-1 font-semibold text-stone-900">{fmtDate(h.date)}</div>
          <div className="flex items-center justify-between gap-2 text-stone-600">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand-600" />{labels.sales}</span>
            <span className="num font-medium text-stone-900">{fmtMoney(h.sales, symbol)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-stone-600">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-amber-600" />{labels.purchases}</span>
            <span className="num font-medium text-stone-900">{fmtMoney(h.purchases, symbol)}</span>
          </div>
        </div>
      )}

      <table className="sr-only">
        <caption>{labels.title}</caption>
        <thead><tr><th>{labels.date}</th><th>{labels.sales}</th><th>{labels.purchases}</th></tr></thead>
        <tbody>
          {days.map((d) => <tr key={d.date}><td>{fmtDate(d.date)}</td><td>{fmtMoney(d.sales, symbol)}</td><td>{fmtMoney(d.purchases, symbol)}</td></tr>)}
        </tbody>
      </table>
    </div>
  )
}
