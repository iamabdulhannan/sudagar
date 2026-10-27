/**
 * Cash drawer: most drawers plug into the receipt printer (RJ11 "DK" port) and open when the
 * printer gets the ESC/POS "pulse" command. Chrome and Edge on computers can send it through the
 * Web Serial API (USB-serial or COM printers). Many printer drivers can also open the drawer on
 * every print; then this is not needed.
 */

/** ESC p 0 25 250: pulse pin 2 for 50 ms on, 500 ms off */
const KICK = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa])
const KEY = 'saudagar.drawerPort'

interface SerialPortLike {
  getInfo(): { usbVendorId?: number; usbProductId?: number }
  open(o: { baudRate: number }): Promise<void>
  close(): Promise<void>
  readable: unknown
  writable: { getWriter(): { write(d: Uint8Array): Promise<void>; releaseLock(): void } } | null
}
interface SerialLike { requestPort(): Promise<SerialPortLike>; getPorts(): Promise<SerialPortLike[]> }

const serial = (): SerialLike | null => (typeof navigator !== 'undefined' && 'serial' in navigator ? (navigator as unknown as { serial: SerialLike }).serial : null)

export const drawerSupported = () => !!serial()

export function drawerConnected(): boolean {
  try { return !!localStorage.getItem(KEY) } catch { return false }
}

/** ask the user to pick the printer's port once; the browser remembers the permission */
export async function connectDrawer(): Promise<void> {
  const s = serial()
  if (!s) throw new Error('NOT_SUPPORTED')
  const port = await s.requestPort()
  const info = port.getInfo()
  try { localStorage.setItem(KEY, JSON.stringify(info)) } catch { /* ignore */ }
}

export function forgetDrawer() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}

async function findPort(): Promise<SerialPortLike | null> {
  const s = serial()
  if (!s) return null
  const ports = await s.getPorts()
  let want: { usbVendorId?: number; usbProductId?: number } = {}
  try { want = JSON.parse(localStorage.getItem(KEY) || '{}') } catch { /* ignore */ }
  return ports.find((p) => { const i = p.getInfo(); return i.usbVendorId === want.usbVendorId && i.usbProductId === want.usbProductId }) ?? ports[0] ?? null
}

/** open the drawer; resolves false when no printer port is set up */
export async function openDrawer(baudRate = 9600): Promise<boolean> {
  const port = await findPort()
  if (!port) return false
  const wasOpen = !!port.writable
  if (!wasOpen) await port.open({ baudRate })
  try {
    const w = port.writable!.getWriter()
    try { await w.write(KICK) } finally { w.releaseLock() }
  } finally {
    if (!wasOpen) await port.close().catch(() => {})
  }
  return true
}
