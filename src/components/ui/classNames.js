// Small shared Tailwind class fragments so focus/control styling stays
// identical across every interactive primitive instead of being hand-copied.
export const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2";

export const CONTROL_BORDER = "border border-slate-500/50";

export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}
