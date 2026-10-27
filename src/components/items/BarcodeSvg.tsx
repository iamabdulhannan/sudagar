import { useMemo } from 'react'
import { code128Bars, isCode128B } from './barcode'

/** Code 128 barcode as an inline SVG. Width follows the container; height in CSS units. */
export function Barcode({ value, height = '12mm', className }: { value: string; height?: string; className?: string }) {
  const data = useMemo(() => (value && isCode128B(value) ? code128Bars(value) : null), [value])
  if (!data) return null
  return (
    <svg
      viewBox={`0 0 ${data.width} 40`}
      preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block' }}
      shapeRendering="crispEdges"
      className={className}
      aria-label={value}
      role="img"
    >
      {data.bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={40} fill="#000" />)}
    </svg>
  )
}
