/**
 * Keep the page scrollable after the iOS keyboard closes.
 *
 * Founder, testing PL PROMPTER on real hardware: "after I dismiss my keyboard
 * the page won't let me go down so I can see anything under".
 *
 * Cause, and it is ours rather than an Even Hub styling issue: iOS shrinks the
 * VISUAL viewport for the keyboard but leaves the LAYOUT viewport alone, scrolls
 * to reveal the focused field, and on dismissal restores the visual viewport
 * without recomputing the page. The document is left offset and anything below
 * the field is unreachable.
 *
 * `interactive-widget=resizes-content` in the viewport meta is the declarative
 * fix, but it is new and WebView support is uneven, so this is the belt to its
 * braces: when the visual viewport grows back, force a reflow and clamp the
 * scroll position back inside the real document height.
 */
export function keepScrollableAfterKeyboard() {
  const vv = window.visualViewport
  if (!vv) return

  let lastHeight = vv.height

  const restore = () => {
    // Touching scrollHeight forces the reflow iOS skipped.
    const docH = document.documentElement.scrollHeight
    const maxScroll = Math.max(0, docH - window.innerHeight)
    if (window.scrollY > maxScroll) window.scrollTo(0, maxScroll)
    // A one-pixel nudge makes WebKit recompute the scrollable area when the
    // clamp above was already satisfied but the page still feels stuck.
    window.scrollBy(0, 1)
    window.scrollBy(0, -1)
  }

  vv.addEventListener('resize', () => {
    const grew = vv.height > lastHeight + 40   // keyboard closing, not a rotation blip
    lastHeight = vv.height
    if (grew) requestAnimationFrame(restore)
  })

  // Some WebViews fire no visualViewport resize at all on dismissal.
  window.addEventListener('focusout', () => setTimeout(restore, 120))
}
