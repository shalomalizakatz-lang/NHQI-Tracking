import { cx } from "./classNames.js";

export default function EmptyState({ tone = "empty", title, description, action, className }) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cx("flex flex-col items-center gap-2 px-6 py-12 text-center", className)}
    >
      <p className={cx("text-sm font-semibold", tone === "error" ? "text-red-800" : "text-slate-900")}>{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
