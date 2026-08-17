// Purely visual — invisible in view mode, shown as a dashed placeholder
// (see .spacer-widget in grid.scss) only while the grid is being edited, so
// it's findable/draggable/resizable there but never takes up perceptible
// space once you're done editing. No props needed: the edit/view distinction
// is driven entirely by CSS off the ancestor .grid-widget-body.is-locked
// class WidgetShell already applies in edit mode, not by this component.
export default function SpacerWidget() {
  return (
    <div className="spacer-widget" aria-hidden="true">
      <span className="spacer-widget-label">Spacer</span>
    </div>
  );
}
