import { cx } from "./classNames.js";

// One plain bordered surface. Do not nest Card inside Card -- if a layout
// seems to need that, it needs a SectionHeading or more spacing instead.
export default function Card({ as: As = "div", className, children, ...rest }) {
  return (
    <As className={cx("rounded-lg border border-slate-200 bg-white", className)} {...rest}>
      {children}
    </As>
  );
}
