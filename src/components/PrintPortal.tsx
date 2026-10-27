import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { ReactNode } from 'react'

/**
 * Print any React node on its own: it is rendered into #print-area, the rest of the app
 * is hidden by CSS (html.printing), and the browser print dialog opens.
 * `page` sets the paper: 'A4', 'A5' or a roll width like '80mm'.
 */
export function printNode(node: ReactNode, page: 'A4' | 'A5' | '80mm' | '58mm' = 'A4') {
  const host = document.getElementById('print-area')!
  host.innerHTML = ''
  const style = document.createElement('style')
  const roll = page.endsWith('mm')
  style.textContent = roll
    ? `@page { size: ${page} auto; margin: 2mm; }`
    : `@page { size: ${page}; margin: 10mm; }`
  document.head.appendChild(style)
  const mount = document.createElement('div')
  host.appendChild(mount)
  const root = createRoot(mount)
  flushSync(() => root.render(node))
  document.documentElement.classList.add('printing')
  const done = () => {
    document.documentElement.classList.remove('printing')
    root.unmount()
    host.innerHTML = ''
    style.remove()
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  // let images (logo) load before the dialog opens
  setTimeout(() => window.print(), 150)
}
