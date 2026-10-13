import { cx } from "./classNames.js";

export default function PageHeader({ eyebrow, title, context, actions, className }) {
  return (
    <div
      className={cx(
        "flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div>
        {eyebrow}
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-[26px]">{title}</h1>
        {context && <p className="mt-1 text-sm text-slate-500">{context}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
