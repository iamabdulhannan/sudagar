import { Component, type ReactNode } from 'react'
import { translate, type Lang } from '../lib/i18n'

/** keeps one broken screen from blanking the whole app */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    const lang = (document.documentElement.lang === 'ur' ? 'ur' : 'en') as Lang
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-lg font-semibold text-stone-900">{translate(lang, 'somethingWrong')}</h1>
        <p className="mt-2 break-words text-sm text-stone-500">{this.state.error.message}</p>
        <button
          type="button"
          onClick={() => { this.setState({ error: null }); window.location.reload() }}
          className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white cursor-pointer"
        >
          {translate(lang, 'tryAgain')}
        </button>
      </div>
    )
  }
}
