// Three CSS-only starfield layers drifting at different speeds (small/near
// = slow, large/close = fast) for a simple parallax "moving through space"
// feel — see styles/shared/background/space-background.scss for the actual
// star generation and drift animation.
export default function SpaceBackground() {
  return (
    <div className="space-background" aria-hidden="true">
      <div className="space-background__layer space-background__layer--small" />
      <div className="space-background__layer space-background__layer--medium" />
      <div className="space-background__layer space-background__layer--large" />
    </div>
  );
}
