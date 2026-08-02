interface SkipLinkProps {
  /** id of the preferred target. Falls back to any rendered main region. */
  targetId?: string;
  children?: React.ReactNode;
}

/** True unless the element, or an ancestor, is `display: none`. */
function isRendered(el: HTMLElement) {
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    if (getComputedStyle(node).display === 'none') return false;
  }
  return true;
}

/**
 * Resolves the main region of the screen the user is actually looking at.
 *
 * The stack keeps departed screens mounted under `display: none`, so several
 * elements can carry the same id at once — `getElementById` would happily
 * return a hidden one.
 */
function findMainRegion(targetId: string) {
  const selector = `#${CSS.escape(targetId)}, main, [role="main"]`;
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    if (isRendered(el)) return el;
  }
  return null;
}

/**
 * "Skip to main content" — the first focusable element on the page.
 *
 * Mount this once, above the navigator (see `App.tsx`). It must not live
 * inside a screen: react-native-web gives every ScrollView a transform, and a
 * transformed ancestor becomes the containing block for `position: fixed`
 * descendants, so a skip link declared inside one scrolls away with the
 * content instead of pinning to the viewport. Mounting it above the navigator
 * also keeps it first in tab order, which is the whole point of a skip link,
 * and means there is only ever one — a per-screen link would linger as a
 * phantom tab stop on screens the stack has hidden but not unmounted.
 */
export function SkipLink({ targetId = 'main-content', children = 'Skip to main content' }: SkipLinkProps) {
  return (
    <a
      className="skip-link"
      href={`#${targetId}`}
      onClick={(e) => {
        // Move focus directly rather than letting the anchor set a URL hash —
        // the app keeps its URLs clean for the Supabase PKCE callback flow.
        e.preventDefault();
        const target = findMainRegion(targetId);
        if (!target) return;
        target.focus();
        target.scrollIntoView();
      }}
    >
      {children}
    </a>
  );
}
