// Purely visual — invisible in view mode, shown as a dashed placeholder
// (grid.scss) only while editing so it's findable/draggable there. The
// edit/view distinction is driven by CSS off the ancestor .is-locked class
// WidgetShell applies, not by this component.
export default function SpacerWidget() {
  return (
    <div className="spacer-widget" aria-hidden="true">
      <span className="spacer-widget-label">Spacer</span>
    </div>
  );
}
