// Small filled circle in any CSS colour — e.g. a collection item's colour in a switcher row.
export default function ColorDot({ color }: { color: string }) {
  return <span className="color-dot" style={{ background: color }} aria-hidden />;
}
