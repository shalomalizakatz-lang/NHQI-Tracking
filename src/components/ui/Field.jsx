import { useId } from "react";
import { CONTROL_BORDER, FOCUS_RING, cx } from "./classNames.js";

// A labeled input with real programmatic association -- label htmlFor/id,
// hint/error wired through aria-describedby, aria-invalid when there's an
// error. Never relies on a placeholder or a dash as the accessible name.
export default function Field({
  label,
  hint,
  error,
  unit,
  className,
  inputClassName,
  id: idProp,
  render,
  ...inputProps
}) {
  const autoId = useId();
  const id = idProp || autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const fieldProps = {
    id,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
  };

  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-sm font-medium text-slate-900">
        {label}
      </label>
      <div className="flex items-center gap-2">
        {render ? (
          render(fieldProps)
        ) : (
          <input
            {...fieldProps}
            {...inputProps}
            className={cx(
              "rounded-[var(--radius-control)] px-2.5 py-1.5 text-sm tabular-nums",
              CONTROL_BORDER,
              error && "border-red-600",
              FOCUS_RING,
              inputClassName
            )}
          />
        )}
        {unit && <span className="text-sm text-slate-500">{unit}</span>}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
