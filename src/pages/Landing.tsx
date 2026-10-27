import { useEffect } from 'react'
import { Benefits } from '../components/landing/Benefits'
import { BusinessTypes } from '../components/landing/BusinessTypes'
import { DeepDives } from '../components/landing/DeepDives'
import { Faq } from '../components/landing/Faq'
import { FinalCta, Footer } from '../components/landing/Footer'
import { Header } from '../components/landing/Header'
import { Hero } from '../components/landing/Hero'
import { MobileBand } from '../components/landing/MobileBand'
import { Pillars } from '../components/landing/Pillars'
import { Stats } from '../components/landing/Stats'
import { useI18n } from '../lib/i18n'

/** sets the tab title and meta description while the page is open, then puts the old ones back */
function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const prevTitle = document.title
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const created = !meta
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    const prevDesc = meta.content
    document.title = title
    meta.content = description
    return () => {
      document.title = prevTitle
      if (created) meta.remove()
      else meta.content = prevDesc
    }
  }, [title, description])
}

/*
 * Nastaliq needs tall lines. Utility leading-* classes would squash it, so in Urdu the page text gets a
 * taller line height. Unlayered CSS beats Tailwind's layered utilities. Mockups (dir="ltr") are left alone.
 */
const URDU_CSS = 'html[lang="ur"] .ld-root :is(h2,h3,p,li,dt,dd,a,button):not(.num):not([dir="ltr"] *){line-height:1.95}'

/** public marketing page at /home */
export default function Landing() {
  const { t } = useI18n()
  usePageMeta(t('ld_metaTitle'), t('ld_metaDesc'))

  // arriving with a hash (/home#faq): jump there once the lazy page has rendered
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1))
    if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
  }, [])

  return (
    <div id="top" className="ld-root min-h-dvh overflow-x-clip bg-page text-stone-900">
      <style>{URDU_CSS}</style>
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
      >
        {t('ld_skip')}
      </a>
      <Header />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <Stats />
        <Pillars />
        <DeepDives />
        <Benefits />
        <BusinessTypes />
        <MobileBand />
        <Faq />
        <div className="pt-4 sm:pt-8" />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
