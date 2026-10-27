import { Camera, CameraOff, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../lib/cx'
import { useI18n } from '../../lib/i18n'

/**
 * Camera barcode scanning with the browser's BarcodeDetector (Chrome on Android, Edge, recent Chrome desktop).
 * Opens a full-screen camera view; the first code found is passed to onCode and the camera stops.
 */

interface DetectedBarcode { rawValue: string; format: string }
interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

const FORMATS = ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e', 'qr_code']

const detectorCtor = () => (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector

/** can this browser scan with the camera at all? */
export const cameraScanSupported = () => !!detectorCtor()

type ScanState = 'starting' | 'scanning' | 'unsupported' | 'denied' | 'nocamera' | 'insecure' | 'error'

export function ScanButton({ onCode, className, label, size = 'md' }: {
  onCode: (code: string) => void
  className?: string
  /** text next to the icon; icon only when empty */
  label?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const box = size === 'lg' ? 'size-10' : size === 'sm' ? 'size-7' : 'size-9'
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t('scanCamera')}
        aria-label={t('scanCamera')}
        className={cx(
          'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-brand-700 cursor-pointer',
          label ? 'h-9 px-2.5 text-sm font-medium' : box,
          className,
        )}
      >
        <Camera className={size === 'sm' ? 'size-4' : 'size-5'} />
        {label && <span>{label}</span>}
      </button>
      {open && <ScanOverlay onClose={() => setOpen(false)} onCode={(c) => { setOpen(false); onCode(c) }} />}
    </>
  )
}

function ScanOverlay({ onClose, onCode }: { onClose: () => void; onCode: (code: string) => void }) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<ScanState>('starting')
  const cb = useRef({ onClose, onCode })
  cb.current = { onClose, onCode }

  // Escape closes only this overlay, even when it sits over another dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      cb.current.onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  useEffect(() => {
    const Ctor = detectorCtor()
    if (!Ctor) { setState('unsupported'); return }
    if (!navigator.mediaDevices?.getUserMedia) { setState(window.isSecureContext ? 'nocamera' : 'insecure'); return }
    let stopped = false
    let stream: MediaStream | null = null
    let timer = 0
    const stop = () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((tr) => tr.stop())
      stream = null
    }
    void (async () => {
      try {
        const supported = Ctor.getSupportedFormats ? await Ctor.getSupportedFormats() : FORMATS
        const formats = FORMATS.filter((f) => supported.includes(f))
        if (!formats.length) { setState('unsupported'); return }
        const detector = new Ctor({ formats })
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (stopped) { stream.getTracks().forEach((tr) => tr.stop()); return }
        const v = videoRef.current
        if (!v) { stop(); return }
        v.srcObject = stream
        await v.play().catch(() => undefined)
        if (stopped) return
        setState('scanning')
        const tick = async () => {
          if (stopped) return
          try {
            if (v.readyState >= 2) {
              const found = await detector.detect(v)
              const code = found.find((x) => x.rawValue?.trim())?.rawValue.trim()
              if (code && !stopped) {
                stop()
                try { navigator.vibrate?.(60) } catch { /* not supported */ }
                cb.current.onCode(code)
                return
              }
            }
          } catch { /* a frame that could not be read; try the next one */ }
          timer = window.setTimeout(tick, 180)
        }
        void tick()
      } catch (err) {
        if (stopped) return
        const name = (err as { name?: string })?.name
        setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nocamera' : 'error')
      }
    })()
    return stop
  }, [])

  const problem = state !== 'starting' && state !== 'scanning'
  const message: Record<Exclude<ScanState, 'starting' | 'scanning'>, string> = {
    unsupported: t('scanUnsupported'),
    denied: t('scanDenied'),
    nocamera: t('scanNoCamera'),
    insecure: t('scanInsecure'),
    error: t('scanError'),
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('scanCamera')}
      className="no-print fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/85 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
          <h2 className="text-base font-semibold text-stone-900">{t('scanCamera')}</h2>
          <button type="button" onClick={onClose} aria-label={t('close')} className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer">
            <X className="size-5" />
          </button>
        </header>
        {problem ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-700"><CameraOff className="size-7" /></div>
            <p className="text-sm text-stone-700">{message[state]}</p>
            {state === 'unsupported' && <p className="text-xs text-stone-500">{t('scanTip')}</p>}
          </div>
        ) : (
          <div className="relative aspect-[3/4] w-full bg-black sm:aspect-video">
            <video ref={videoRef} className="size-full object-cover" playsInline muted />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-32 -translate-y-1/2 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
              <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-red-500" />
            </div>
            {state === 'starting' && (
              <div className="absolute inset-0 grid place-items-center text-white/80"><Loader2 className="size-8 animate-spin" /></div>
            )}
          </div>
        )}
        <p className="px-4 py-3 text-center text-xs text-stone-500">{problem ? '' : t('scanHint')}</p>
      </div>
    </div>,
    document.body,
  )
}
