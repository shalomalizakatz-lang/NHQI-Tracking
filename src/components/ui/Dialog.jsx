import { useEffect, useId, useRef } from "react";
import { FOCUS_RING, cx } from "./classNames.js";

// Built on the native <dialog> element: showModal() gives real focus
// containment and automatic focus-return to the invoking element for free in
// every evergreen browser, and Escape fires the native "cancel" event. jsdom
// (used by the vitest/testing-library unit tests in this repo) doesn't
// implement showModal yet, so there's a plain-attribute fallback that keeps
// those tests able to render/open/close the dialog -- real focus-trap and
// focus-return behavior is verified separately with Playwright against an
// actual browser, where showModal is used for real.
export default function Dialog({ open, onClose, title, children, placement = "center", className }) {
  const ref = useRef(null);
  const titleId = useId();
  const returnFocusRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const supportsNative = typeof el.showModal === "function";
    if (open) {
      returnFocusRef.current = document.activeElement;
      if (supportsNative) el.showModal();
      else el.setAttribute("open", "");
    } else if (el.open || el.hasAttribute("open")) {
      if (supportsNative) el.close();
      else {
        el.removeAttribute("open");
        returnFocusRef.current?.focus?.();
      }
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleCancel = e => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", handleCancel);
    return () => el.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  // A document-level listener (rather than one on the dialog node) so Escape
  // closes it even before the fallback path (no native showModal support)
  // has moved focus inside -- the native "cancel" handler above covers real
  // browsers using showModal, this covers the jsdom test fallback too.
  //
  // Also a manual Tab/Shift+Tab wrap: showModal() alone does NOT reliably
  // keep Tab cycling inside the dialog in every real browser -- confirmed by
  // Playwright testing against actual Chromium, where Tab from the last
  // focusable element inside the dialog escaped to <body> instead of
  // wrapping back to the first one. Without this, "focus containment" would
  // only be true in theory, not in the browser this app actually ships to.
  useEffect(() => {
    if (!open) return;
    const handleKeydown = e => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const el = ref.current;
      if (!el) return;
      const focusable = el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [open, onClose]);

  const isDrawer = placement === "right";

  return (
    <dialog
      ref={ref}
      aria-labelledby={title ? titleId : undefined}
      onClick={e => {
        if (e.target === ref.current) onClose();
      }}
      className={cx(
        "rounded-lg border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/40",
        isDrawer
          ? "fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-full max-w-md rounded-none"
          : "m-auto w-full max-w-lg",
        className
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          {title && (
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h2 id={titleId} className="text-base font-semibold text-slate-900">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className={cx("rounded-[var(--radius-control)] p-1 text-slate-500 hover:bg-slate-100", FOCUS_RING)}
              >
                ✕
              </button>
            </div>
          )}
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
