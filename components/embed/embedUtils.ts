import { useEffect } from 'react'

/**
 * Helpers shared by the partner booking popups under /pages/embed/*.
 *
 * The popups are designed to be iframed onto the partner sites
 * (luggagelockers.is, bikerent.is) in place of their old Fillout embeds.
 */

/** postMessage type the parent page listens for to size the iframe. */
export const EMBED_HEIGHT_MESSAGE = 'bagbee-embed-height'

/**
 * Continuously report the document height to the parent window so the embed
 * iframe can size itself to the content (no inner scrollbar). No-op when the
 * page is not framed (opened directly).
 */
export const useEmbedAutoResize = (): void => {
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return

    const post = () => {
      const height = Math.ceil(
        Math.max(
          document.documentElement.scrollHeight,
          document.body?.scrollHeight || 0,
        ),
      )
      window.parent.postMessage({ type: EMBED_HEIGHT_MESSAGE, height }, '*')
    }

    post()
    const ro = new ResizeObserver(post)
    if (document.body) ro.observe(document.body)
    window.addEventListener('load', post)
    return () => {
      ro.disconnect()
      window.removeEventListener('load', post)
    }
  }, [])
}

/**
 * Navigate the *top* window to a URL, breaking out of the embed iframe. Used to
 * send the customer to Rapyd's hosted checkout (which refuses to be framed) and
 * back to the bagbee.is manage-booking page after payment.
 */
export const redirectTop = (url: string): void => {
  try {
    const top = window.top || window
    top.location.href = url
  } catch {
    // Cross-origin access to window.top can throw — fall back to self.
    window.location.href = url
  }
}
