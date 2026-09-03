'use client';

import { calcGridItemPosition, calcWH, calcXY, cloneLayout, getLayoutItem, moveElement, useContainerWidth, verticalCompactor } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import type { Ref } from 'react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import {
  DEFAULT_WIDGET_MIN_SIZE,
  GRID_COLS,
  GRID_CONTAINER_PADDING,
  GRID_ITEM_MARGIN,
  GRID_PREVIEW_WIDTHS,
  GRID_ROW_HEIGHT,
  PAGE_CHANGE_COOLDOWN_MS,
  PAGE_GAP_PX,
  PAGE_PEEK_SLIVER_PX,
  pageSoftHeightRows,
  pageTrackWidth,
  VIEW_MODE_PEEK_GAP_PX,
} from '../../lib/grid/gridConfig';
import type { DashboardBreakpoint, DashboardBreakpointState, DashboardWidget } from '../../lib/types';
import { areGesturesLocked, lockGestures, unlockGestures } from '../../lib/gestureLock';
import { clampPageIndex, virtualPageSignature } from '../../lib/grid/pageNavigation';
import { tryClaimPageChange } from '../../lib/grid/pageChangeCooldown';
import { waitForTransitionEnd } from '../../lib/grid/transitionSettle';
import { getEventPoint, isPointInRect, type Point } from '../../lib/grid/pointerEvents';
import { findWidgetDefinition } from '../../lib/grid/widgetRegistry';
import type { ResizeCorner } from './ResizeHandle';
import AddWidgetModal from './AddWidgetModal';
import BlankPagePane from './BlankPagePane';
import CanvasContextMenu from './CanvasContextMenu';
import GridPage from './GridPage';
import RemoveDropZone from './RemoveDropZone';
import { useCloseMenuOnOutsideClick } from './useCloseMenuOnOutsideClick';
import { useLongPress, WIDGET_GESTURE_SKIP_SELECTOR } from './useLongPress';
import { usePageNavigation } from './usePageNavigation';
import { usePageSlide } from './usePageSlide';
import { useViewportHeight } from './useViewportHeight';

const SWIPE_DISTANCE_PX = 50; // minimum horizontal travel to count as a swipe (fast-flick path)
const SWIPE_MAX_DURATION_MS = 300; // "quickly" — slower drags read as a scroll/hesitation, not a page-swipe
const SWIPE_DIRECTION_LOCK_RATIO = 1.5; // |dx| must exceed |dy| by this much before a touch gesture locks horizontal
const SWIPE_COMMIT_FRACTION = 0.4; // slow drag past this fraction of a page width also commits, flick or not
const WHEEL_SWIPE_THRESHOLD = 60; // accumulated horizontal wheel delta to trigger a page change
const PAGE_SLIDE_MS = 250; // kept in sync by hand with .grid-page-track's transition duration
const RUBBER_BAND_MAX_PX = 80; // asymptotic cap on how far a drag can pull the track past an edge with no neighbor
const RUBBER_BAND_RESISTANCE = 0.55; // 0..1 — lower = stiffer resistance past the edge
const PAGE_HOP_HOLD_MS = 500; // how long a dragged widget must hover a peek neighbor before it hops onto that page

// Diminishing-returns curve (same shape as UIScrollView's overscroll bounce)
// for dragging the track past an edge with no neighbor to reveal — used only
// while the live drag has nowhere real to go; a valid target instead tracks
// the finger 1:1 all the way (see handleTouchMove below).
function rubberBand(dx: number): number {
  const sign = dx < 0 ? -1 : 1;
  const magnitude = Math.abs(dx);
  return (sign * magnitude * RUBBER_BAND_RESISTANCE * RUBBER_BAND_MAX_PX) / (RUBBER_BAND_MAX_PX + RUBBER_BAND_RESISTANCE * magnitude);
}

// Shared by the drag and resize engines below — both compute grid<->pixel
// positions against a page's own measured grid box, otherwise identically.
function buildPositionParams(containerWidth: number, cols: number) {
  return {
    margin: GRID_ITEM_MARGIN,
    containerPadding: GRID_CONTAINER_PADDING,
    containerWidth,
    cols,
    rowHeight: GRID_ROW_HEIGHT,
    maxRows: Infinity,
  };
}

type GridProps = {
  breakpoints: Record<DashboardBreakpoint, DashboardBreakpointState>;
  // Persists across gestures (page.tsx state) — replaces the old edit-
  // toolbar's breakpoint Tabs; null means "not simulating any tier, show
  // whatever the real device is." Set via CanvasContextMenu's "Preview as".
  previewBreakpoint: DashboardBreakpoint | null;
  allowedBreakpoints: DashboardBreakpoint[];
  onPreviewBreakpointChange: (breakpoint: DashboardBreakpoint | null) => void;
  // The device's own real tier (from useDeviceTier), distinct from
  // previewBreakpoint (which can simulate a *different* tier). Used to tell
  // "genuinely simulating another device" apart from "on the tier you're
  // actually on" — see isSimulating below.
  deviceTier: DashboardBreakpoint;
  activePageIndex: Record<DashboardBreakpoint, number>;
  onPageIndexChange: (breakpoint: DashboardBreakpoint, index: number) => void;
  onLayoutChange: (breakpoint: DashboardBreakpoint, pageId: string, layout: Layout) => void;
  onAddWidget: (type: string, breakpoint: DashboardBreakpoint, pageId: string) => void;
  onUpdateWidget: (
    id: string,
    breakpoint: DashboardBreakpoint,
    pageId: string,
    patch: Partial<Omit<DashboardWidget, 'id'>>
  ) => void;
  onRemoveWidget: (id: string, breakpoint: DashboardBreakpoint, pageId: string) => void;
  onWidgetHeightsChange: (
    breakpoint: DashboardBreakpoint,
    pageId: string,
    patches: Array<{ id: string; h: number }>
  ) => void;
  onCreatePage: (breakpoint: DashboardBreakpoint) => string;
  onMoveWidgetToPage: (id: string, breakpoint: DashboardBreakpoint, fromPageId: string, toPageId: string) => void;
};

// Exposed so page.tsx's PageDots (a direct, single-shot click just like
// peek-click, but living outside this component) shares the exact same
// requestPage entry point — and so the exact same mid-slide queuing — as
// every other navigation gesture here, instead of committing straight to
// activePageIndex and risking a fast adjacent click misfiring the "distant
// jump" snap. See usePageSlide's requestPage for the actual queuing rules.
export type GridHandle = {
  requestPage: (index: number) => void;
};

function Grid(
  {
    breakpoints,
    previewBreakpoint,
    allowedBreakpoints,
    onPreviewBreakpointChange,
    deviceTier,
    activePageIndex,
    onPageIndexChange,
    onLayoutChange,
    onAddWidget,
    onUpdateWidget,
    onRemoveWidget,
    onWidgetHeightsChange,
    onCreatePage,
    onMoveWidgetToPage,
  }: GridProps,
  ref: Ref<GridHandle>
) {
  const { width, containerRef, mounted } = useContainerWidth();

  // True only while a widget move/resize gesture is actually in flight —
  // was isEditMode's persistent toggle; the whole point of this refactor is
  // that edit-mode chrome/geometry now exists only for the duration of an
  // actual drag, not a standing session. Set by beginDrag/beginResize below,
  // cleared by their matching endDrag/endResize.
  const [isDragActive, setIsDragActive] = useState(false);
  // Narrower than isDragActive — true only while a whole-widget MOVE is in
  // flight (beginDrag/endDrag), never during a resize. Drives the
  // canvas-shrink visual (see .grid-page-viewport--drag-shrink in grid.scss)
  // and RemoveDropZone. Deliberately excludes resize: that engine captures a
  // pixel baseline once (state.startWidthPx) and adds raw cursor deltas to
  // it every frame, which assumes a stable coordinate system for the whole
  // gesture — a canvas that's still mid-transition when resizing starts (a
  // continuously-changing scale, not a fixed before/after value) would
  // throw that baseline off for as long as the shrink animation plays.
  // Dragging has no such baseline (applyRelocatedPosition re-measures the
  // grid fresh every frame via calcXY), so it doesn't have this problem.
  const [isMoveDragActive, setIsMoveDragActive] = useState(false);

  // Skip the fixed preview width when on your own actual tier (not
  // simulating another) — real devices can be narrower than the simulated
  // width, which would otherwise overflow the screen. Independent of
  // isDragActive now — previewing a tier is its own persistent concern, not
  // scoped to a single gesture.
  const isSimulating = previewBreakpoint !== null && previewBreakpoint !== deviceTier;

  // Each breakpoint owns its full page set, swapped wholesale rather than
  // using react-grid-layout's built-in breakpoint switching. View mode keys
  // off deviceTier (window width), not measured container width, to avoid a
  // feedback loop where height-driven scrollbars change the width.
  const effectiveBreakpoint = previewBreakpoint ?? deviceTier;
  const { pages } = breakpoints[effectiveBreakpoint];

  const handlePageIndexChange = useCallback(
    (index: number) => onPageIndexChange(effectiveBreakpoint, index),
    [onPageIndexChange, effectiveBreakpoint]
  );

  // The track only ever has a transform for two states — "has a prev" or
  // not — since it's always a 3-slot window (prev/active/next), regardless
  // of the real page count. So sliding through the actual deck requires an
  // explicit two-phase commit: on an adjacent-step navigation, keep showing
  // the OLD prev/active/next (via this lagging `displayedIndex`) but shift
  // the track one extra step further, so it visually lands exactly where
  // the new prev/active/next would sit once reassigned — then, once that
  // animation settles, swap the assignment and reset the transform
  // instantly (no-transition) to the same visual position. A non-adjacent
  // jump (e.g. a distant dot click) just cuts straight there, uncapped.
  const committedIndex = activePageIndex[effectiveBreakpoint] ?? 0;

  // DOM ref to .grid-page-track — declared up here (rather than down with
  // the rest of the drag-to-edge refs) since usePageSlide needs it to drive
  // the track's transform/transition directly.
  const trackRef = useRef<HTMLDivElement>(null);

  const pageSlide = usePageSlide({
    committedIndex,
    pages,
    allowBlankSlot: isDragActive,
    trackRef,
    onCommit: handlePageIndexChange,
  });
  const { displayedIndex, trackOffsetReady } = pageSlide;

  // A drag/resize ending flips isDragActive off (and so every page's own
  // geometry) instantly, straight away. But if displayedIndex is still
  // lagging on the blank "create new page" slot (index === pages.length —
  // see the committedIndex/displayedIndex comment above) when that happens,
  // endDrag has already clamped committedIndex down to the last real page in
  // the very same commit — this is what keeps the blank slot itself in the
  // virtual page set for exactly as long as that slide-back is still
  // playing, instead of vanishing out from under it before the animation
  // even gets a chance to run. Once displayedIndex catches up, this goes
  // false right along with isDragActive and the blank slot drops out for
  // good.
  const showBlankSlot = isDragActive || displayedIndex === pages.length;

  const { activeIndex, current, prev, next, goToIndex, virtualPages } = usePageNavigation(
    pages,
    showBlankSlot,
    displayedIndex,
    handlePageIndexChange
  );

  // Corrective/programmatic repositioning (a drag-to-edge hop's own target
  // correction, landing on the new last page once a trailing page auto-
  // deletes, a breakpoint switch) — these have to land regardless of a
  // recent user gesture or an in-flight slide, so they bypass requestPage's
  // queuing/cooldown-adjacent logic entirely via forceLand, which snaps
  // instantly rather than animating or queuing behind whatever's playing.
  // Correctness beats smoothness here — see pageChangeCooldown.ts's own
  // note on why these are excluded from its cooldown.
  const forceGoToIndex = useCallback(
    (index: number) => {
      pageSlide.forceLand(index);
      goToIndex(index);
    },
    [pageSlide, goToIndex]
  );

  // Clicking a peeking neighbor is a direct, single-shot user navigation
  // gesture, same as keyboard/dots — all three funnel through the same
  // requestPage, which handles the mid-slide queuing itself (see
  // usePageSlide.ts).
  const handlePeekClick = useCallback((index: number) => pageSlide.requestPage(index), [pageSlide]);

  useImperativeHandle(ref, () => ({ requestPage: pageSlide.requestPage }), [pageSlide.requestPage]);

  // Which page just got committed as active (e.g. a widget-drag hop's own
  // forceGoToIndex, or a click/swipe), independent of the lagging displayedIndex
  // above — virtualPages itself doesn't depend on which index is "current",
  // so this is safe to look up against the SAME array prev/current/next
  // were built from. Lets the outline below start turning blue the instant
  // the hop commits, rather than waiting out the slide-settle delay that
  // prev/current/next's role reassignment (deliberately) still waits for.
  const committedVirtualPage = virtualPages[clampPageIndex(committedIndex, pages.length, showBlankSlot)] ?? null;
  const committedSignature = virtualPageSignature(committedVirtualPage);
  const isPrevCommitted = !!prev && virtualPageSignature(prev) === committedSignature;
  const isCurrentCommitted = !!current && virtualPageSignature(current) === committedSignature;
  const isNextCommitted = !!next && virtualPageSignature(next) === committedSignature;

  // Tracks whichever page was actually rendered as `current` as of the last
  // completed render, for the reflow-forcing effect further down to compare
  // against — lets it recognize "this peek slot is simply the page that was
  // JUST active, demoting" as a distinct case from "a genuinely different
  // page is entering this slot". Deliberately NOT committedSignature: that
  // updates the instant a click commits, still several renders (the whole
  // slide) before `current` itself actually changes at settle — using it
  // here would start reflecting the new page far too early, defeating the
  // comparison below for the entire slide.
  const currentSignature = virtualPageSignature(current);
  const previousCurrentSignatureRef = useRef(currentSignature);
  useEffect(() => {
    previousCurrentSignatureRef.current = currentSignature;
  });

  // Mid-slide (an adjacent-step move only — see committedIndex/displayedIndex
  // above), the page just beyond the one becoming active hasn't been
  // rendered at all yet, since prev/current/next above are still keyed off
  // the OLD displayedIndex. Render it here too, past whichever of next/prev
  // it's beyond (see the track JSX below), so it can fade in and then simply
  // ride along with the shared track transform, instead of popping in at
  // full opacity the instant the slide settles and role-reassignment
  // reveals it as the real new prev/next.
  // usePageSlide independently recomputes this same lookahead page (via
  // isLookaheadFreshMount in pageNavigation.ts) to decide whether to hold
  // the track at rest for a couple of frames before animating — see that
  // function's own comment for why it's not simply handed this value.
  const slideDirection = committedIndex - displayedIndex;
  const lookaheadPage =
    Math.abs(slideDirection) === 1 ? virtualPages[activeIndex + slideDirection * 2] ?? null : null;
  const lookaheadSignature = virtualPageSignature(lookaheadPage);

  // Same idea as previousCurrentSignatureRef above, but for whichever page
  // held the lookahead role a render ago — read by the Chromium reflow fix
  // further down so it doesn't cycle display:none on a page that's simply
  // being promoted from lookahead into prev/next (already on screen, riding
  // the shared transform) as if it had just newly entered the track. Doing
  // so would "fix" a layout bug by re-introducing the exact animation-restart
  // problem the matching-key change above was meant to solve, just via a raw
  // DOM display toggle instead of a React remount.
  const previousLookaheadSignatureRef = useRef(lookaheadSignature);
  useEffect(() => {
    previousLookaheadSignatureRef.current = lookaheadSignature;
  });

  // Resets to fully transparent the instant a NEW page takes on the
  // lookahead role, then fades it to opaque on the next frame — flipping
  // straight to the visible class on the same mount wouldn't transition at
  // all, since the browser never gets to paint the "before" state to
  // animate away from.
  const [lookaheadVisible, setLookaheadVisible] = useState(false);
  useEffect(() => {
    // Synchronizing to which page (if any) currently holds the lookahead
    // role — not derivable during render, since the fade needs an actual
    // "before" frame painted first.
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setLookaheadVisible(false);
    if (lookaheadSignature === 'none') return;
    const raf = requestAnimationFrame(() => setLookaheadVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [lookaheadSignature]);

  const viewportHeight = useViewportHeight();
  // Advisory-only (see gridConfig.ts) — no longer scoped to an editing
  // session (there isn't a standing one anymore), so it's just always shown
  // once there's a real viewport height to measure against.
  const softLimitRows = viewportHeight > 0 ? pageSoftHeightRows(viewportHeight) : undefined;

  // A drag/resize ending should hide the border immediately rather than
  // fading it out — plainly giving outline-color a 0s duration outside of
  // .grid-page-slot--dragging (see grid.scss) turned out not to reliably win
  // once other transitionable properties are ALSO changing on the exact
  // same render (min-height, --dragging itself). Forcing it via the same
  // toggle-a-class/reflow/next-frame-remove trick already used elsewhere
  // (see usePageSlide's applyInstant and the Chromium reflow fix below)
  // sidesteps that ambiguity entirely, at the cost of one extra ref.
  const activeSlotRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (isDragActive) return;
    const el = activeSlotRef.current;
    if (!el) return;
    el.classList.add('grid-page-slot--no-outline-transition');
    void el.offsetHeight; // force a reflow so the disable actually takes effect
    const raf = requestAnimationFrame(() => el.classList.remove('grid-page-slot--no-outline-transition'));
    return () => cancelAnimationFrame(raf);
  }, [isDragActive]);

  // isDragActive flipping changes reservePx/pageWidth below, which shifts
  // restingTrackOffsetPx (the track needs room for a peek-neighbor sliver
  // while a drag might hop onto one) — without this, that shift plays as an
  // unwanted 250ms slide on the track's own CSS transition (see grid.scss's
  // .grid-page-track) firing in the middle of the drag/resize gesture that
  // just started or ended, instead of snapping instantly the way every other
  // isDragActive-driven geometry change already does. Same toggle-a-class/
  // reflow/next-frame-remove trick as usePageSlide's applyInstant.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.classList.add('grid-page-track--no-transition');
    void track.offsetHeight; // force a reflow so the disable actually takes effect
    const raf = requestAnimationFrame(() => track.classList.remove('grid-page-track--no-transition'));
    return () => cancelAnimationFrame(raf);
  }, [isDragActive]);

  // While a drag/resize is in flight, reserve room on each edge for a
  // neighbor's sliver plus a gap before it — needed so a dragged widget has
  // a peeking neighbor to hop onto (see the drag-to-edge block further
  // down). At rest, reserve nothing (the active page keeps the full canvas
  // width), so a neighbor sits fully off-screen and only passes through
  // during the slide transition. It still needs its OWN gap though —
  // VIEW_MODE_PEEK_GAP_PX, not 0 — since a neighbor stays mounted (see
  // GridPage below) and .grid-page-viewport never clips; without a gap wide
  // enough to clear .dashboard-container's inline padding, sitting flush
  // against the active page's edge would let it poke into that padding
  // right at the screen edge instead of staying fully hidden.
  const reservePx = isDragActive ? PAGE_PEEK_SLIVER_PX + PAGE_GAP_PX : 0;
  const slotGapPx = isDragActive ? PAGE_GAP_PX : VIEW_MODE_PEEK_GAP_PX;

  // The local coordinate space the peek carousel lays out within: the real
  // canvas normally, but while simulating a device, the device's own width
  // plus room for a neighbor's sliver on each edge — NOT the real (wider)
  // canvas, so a peeking neighbor reads at the same size as the device
  // being simulated rather than the real screen.
  const localCanvasWidth = isSimulating
    ? GRID_PREVIEW_WIDTHS[effectiveBreakpoint] + 2 * reservePx
    : width;

  // Every page (active or neighbor) renders at this same full, unscaled
  // width — the local canvas width minus whatever's reserved on each edge.
  // Reserved whether or not a neighbor actually exists, so the canvas
  // doesn't resize as you page toward either end. Equals GRID_PREVIEW_WIDTHS
  // exactly while simulating (by construction) — no separate preview-frame
  // chrome to account for, since .grid-preview-frame carries no padding of
  // its own (see grid.scss): the same GRID_CONTAINER_PADDING every
  // breakpoint's react-grid-layout already reserves internally is the only
  // inset, so it looks identical to editing your own real breakpoint.
  const pageWidth = pageTrackWidth(localCanvasWidth, reservePx);

  // localCanvasWidth is narrower than the real canvas while simulating —
  // .grid-page-viewport still clips at the real width (see below), rather
  // than a matching narrower one, so a peeking neighbor is only cut off by
  // the real screen edge, never by an artificial inner boundary. This shifts
  // the whole local peek/gap/active/gap/peek assembly to sit centered
  // within that wider real viewport (half the leftover space); zero when
  // not simulating (localCanvasWidth === width).
  const simulatedCenteringOffsetPx = (width - localCanvasWidth) / 2;

  // Shifts the page track so the active page always sits centered — even
  // on the first page, where there's no `prev` pushing it rightward — with
  // exactly `reservePx` of margin (a neighbor peeking in, or just empty
  // space if none exists) on each side.
  const restingTrackOffsetPx = simulatedCenteringOffsetPx + reservePx - (prev ? pageWidth + slotGapPx : 0);
  // Mid-slide (committedIndex ahead of/behind displayedIndex by one step),
  // overshoot by one extra slot in that direction — see the comment above
  // committedIndex/displayedIndex for why this, rather than just jumping
  // straight to the new prev/active/next, is what actually animates.
  const trackOffsetPx =
    restingTrackOffsetPx - (trackOffsetReady ? committedIndex - displayedIndex : 0) * (pageWidth + slotGapPx);

  const handleUpdateWidget = useCallback(
    (id: string, pageId: string, patch: Partial<Omit<DashboardWidget, 'id'>>) =>
      onUpdateWidget(id, effectiveBreakpoint, pageId, patch),
    [onUpdateWidget, effectiveBreakpoint]
  );
  const handleRemove = useCallback(
    (id: string, pageId: string) => {
      const pageIndex = pages.findIndex((p) => p.id === pageId);
      const targetPage = pages[pageIndex];
      // Removing a page's only widget auto-deletes that page (see
      // withEmptyPageCollapsed). If it's the LAST page, land on the new
      // last real page instead of the blank slot that now occupies this
      // index — matches a browser closing its last tab, not stranding you
      // on "create a new page" as a side effect of a deletion.
      const willDeletePage = !!targetPage && targetPage.widgets.length === 1 && pages.length > 1 && pageIndex === pages.length - 1;
      onRemoveWidget(id, effectiveBreakpoint, pageId);
      if (willDeletePage) forceGoToIndex(pageIndex - 1);
    },
    [onRemoveWidget, effectiveBreakpoint, pages, forceGoToIndex]
  );
  // --- Drag-to-edge: dragging a widget onto a peek neighbor's actual
  // hitbox (its rendered bounding box — see isPointInRect below, not a
  // column-count threshold) relocates it onto that page immediately and
  // the view follows, while the same gesture keeps going so the user can
  // choose exactly where to drop it (see the drag block further down).
  // Only wired on the active page — peek panes do share isDragActive's true
  // value (so an incoming page already looks drag-ready mid-slide, not
  // "normal" until it lands), but their wrapping .grid-page-slot-content is
  // pointer-events:none, so no pointer event ever reaches their widgets
  // regardless.
  const armLeftRef = useRef<HTMLDivElement>(null);
  const armRightRef = useRef<HTMLDivElement>(null);
  const removeZoneRef = useRef<HTMLDivElement>(null);

  // Chromium can mis-layout .grid-page-track on the very first paint after
  // a slot's content changes (e.g. a neighbor's presence toggling) at the
  // same time its transform updates — it keeps a stale, pre-change flex
  // content width, landing every slot one pageWidth further left than
  // intended. Toggling display off/on the affected PEEK slot(s), rather
  // than the whole track, forces Chromium to redo the track's flex layout
  // around them just the same, but without also cycling the active slot's
  // own box through display:none — which would silently cancel any CSS
  // transition running on it (e.g. the border/outline fade below) even
  // though the active slot's content never actually changed. Keyed by
  // slotSignature (see above) so this only re-fires when a slot's actual
  // page changes, not on every prev/next reference change.
  const prevSignature = virtualPageSignature(prev);
  const nextSignature = virtualPageSignature(next);
  useLayoutEffect(() => {
    // The page that was JUST active a render ago demoting into this peek
    // slot is a real page-change too (so it'd normally get the toggle below
    // like any other), but it's mid-fading its own outline OUT right now
    // (see grid.scss) — cycling it through display:none would cancel that
    // transition before the browser ever gets to paint it, snapping the
    // border away instantly instead. Skip only that specific arm; a
    // genuinely different page entering the other side still gets fixed up
    // as before. Same reasoning for a page that was the LOOKAHEAD a render
    // ago and just got promoted straight into this slot (see the matching
    // lookaheadSlot key above) — it's already on screen and already correctly
    // laid out, not a fresh arrival Chromium could have mis-measured, so
    // cycling it would only serve to restart any CSS animation inside it.
    const outgoingSignature = previousCurrentSignatureRef.current;
    const outgoingLookaheadSignature = previousLookaheadSignatureRef.current;
    // Collect first, then force ONE shared reflow for both arms — matches
    // the role-change effect below, which found two separate forced
    // reflows (one per arm) measurably slower than a single shared one.
    const toggled: HTMLElement[] = [];
    for (const [signature, el] of [
      [prevSignature, armLeftRef.current],
      [nextSignature, armRightRef.current],
    ] as const) {
      if (!el || signature === outgoingSignature || signature === outgoingLookaheadSignature) continue;
      el.style.display = 'none';
      toggled.push(el);
    }
    if (toggled.length === 0) return;
    void trackRef.current?.offsetHeight; // one shared forced reflow, flushed for both arms at once
    for (const el of toggled) el.style.display = '';
  }, [prevSignature, nextSignature]);

  // react-grid-layout has its own internal "mounted" flag that permanently
  // enables its CSS transforms/transitions after a <GridLayout>'s true first
  // render. Since a page's GridPage now survives a peek<->active role change
  // instead of remounting (see the shared-key comments below), that flag
  // stays "on" for the rest of that instance's life — so EVERY later role
  // handoff needs its own transition explicitly snapped off for one frame,
  // on both the page losing active status and the one gaining it (a role
  // change on either side can equally leave react-grid-layout free to
  // animate something), or the settled slide is immediately followed by a
  // second, unwanted mini-animation as items "jump" into place.
  //
  // Done here rather than inside GridPage itself so both affected pages
  // share ONE forced layout read (via track.offsetHeight, which flushes
  // pending layout for the whole subtree) instead of each forcing its own —
  // two separate reflows for one role handoff was measurably slower,
  // especially for a page with a lot of widget content.
  //
  // Skipped on the very first run (a fresh mount of Grid itself) — there's
  // no prior role assignment yet for any of this to be canceling.
  const hasSnappedRoleChangeRef = useRef(false);
  useLayoutEffect(() => {
    if (!hasSnappedRoleChangeRef.current) {
      hasSnappedRoleChangeRef.current = true;
      return;
    }
    const track = trackRef.current;
    const gridEls = track?.querySelectorAll<HTMLElement>('.grid-page-slot--active .grid, .grid-page-slot--peek .grid');
    if (!track || !gridEls || gridEls.length === 0) return;
    for (const el of gridEls) el.classList.add('grid--no-transition');
    void track.offsetHeight; // one shared forced reflow, flushed for every affected page at once
    const raf = requestAnimationFrame(() => {
      for (const el of gridEls) el.classList.remove('grid--no-transition');
    });
    return () => cancelAnimationFrame(raf);
  }, [currentSignature]);

  // A breakpoint switch is a different page set entirely, not a slide —
  // force-land on it immediately, uncapped, regardless of whether the gap
  // to the new breakpoint's own remembered index happens to look adjacent.
  // Deliberately NOT keyed on isDragActive too (despite it also changing
  // reservePx/pageWidth): a drag starting/ending alone, on the SAME
  // breakpoint, either leaves committedIndex/displayedIndex equal (nothing
  // to resync) or — exiting from the blank "new page" slot — puts them
  // exactly one step apart, which usePageSlide's own effect above already
  // animates correctly on its own via showBlankSlot. Forcing a land here too
  // would win that race (this effect runs after usePageSlide's own, same
  // commit, and forceLand's dispatch cancels whatever that effect just
  // started) and cut the animation short into an instant jump.
  useLayoutEffect(() => {
    pageSlide.forceLand(activePageIndex[effectiveBreakpoint] ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveBreakpoint]);

  // Tracks a widget drag while it's in flight (see beginDrag further down)
  // — declared up here so the liveRef confirmation effect right below can
  // reference it. Starts out targeting the SOURCE page (a plain same-page
  // drag); hopping onto a neighbor (see hopToNeighbor) just retargets it.
  // awaitingExit and pendingConfirmation each guard a different race:
  // - awaitingExit: the peek hitbox is a fixed screen region that doesn't
  //   move just because a hop changed which page occupies it, so a hop
  //   can't be allowed to re-trigger merely because the cursor is STILL
  //   sitting inside that region afterward (real mouse input is never
  //   perfectly stationary). This enforces an edge trigger instead of a
  //   level trigger — once true (set on every hop), the cursor has to
  //   actually leave the hitbox and come back before another hop is
  //   allowed at all. Without it, lingering chains hops indefinitely,
  //   spinning up a fresh blank page every time it runs out of real
  //   neighbors.
  // - pendingConfirmation: closing the exit/re-entry gap fast enough (a
  //   quick flick back toward the original page) can satisfy awaitingExit
  //   before React has actually re-rendered to reflect the FIRST hop —
  //   forceGoToIndex/onMoveWidgetToPage only take effect on some later
  //   render, not synchronously inside hopToNeighbor. A second hop firing
  //   in that gap reads liveRef.current still holding the pre-hop snapshot,
  //   computing a forceGoToIndex target from data that's already stale by
  //   the time it lands, which desyncs activePageIndex from the actual page
  //   list — and page.tsx's own clamp effect (which corrects
  //   activePageIndex against the real page count) and usePageSlide's own
  //   slide-settle effect (which reacts to activePageIndex via
  //   committedIndex) then fight over the result, which is what actually
  //   trips React's "Maximum update depth exceeded" guard, not a direct
  //   loop in this file. Blocking any new hop until the previous one is
  //   confirmed landed (current page id === its target) closes this
  //   regardless of how fast the mouse moves.
  // grabOffsetX/Y: the cursor's pixel offset from the widget's own
  // top-left, captured once from its real on-screen box when the drag
  // starts (see the ghost element created in beginDrag) — preserved across
  // every subsequent hop so the ghost keeps tracking the cursor at the
  // exact same spot within it the whole time.
  // armedForRemove: whether the ghost is currently hovering RemoveDropZone
  // — re-evaluated every pointer-move frame (see handleDragPointerMove);
  // endDrag reads it once, at release, to decide delete vs. commit-position.
  const dragRef = useRef<{
    widgetId: string;
    w: number;
    h: number;
    targetPageId: string;
    awaitingExit: boolean;
    pendingConfirmation: boolean;
    armedForRemove: boolean;
    grabOffsetX: number;
    grabOffsetY: number;
  } | null>(null);

  // Requires the cursor to keep sitting inside a peek neighbor's hitbox for
  // PAGE_HOP_HOLD_MS before it actually triggers a hop, rather than firing
  // the instant it enters — a bare hitbox test made brushing past a
  // neighbor (or overshooting a drop target) on the way somewhere else read
  // as an accidental page switch. Re-arming (not resetting) on repeated
  // calls for the SAME side is what makes this a one-shot dwell timer
  // rather than something that restarts every drag-move frame.
  const hopHoldTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hopHoldDirectionRef = useRef<'left' | 'right' | null>(null);
  // Reassigned imperatively by whichever caller last armed the hold (same
  // ref-callback pattern as hopToNeighborRef below), rather than threaded
  // through as a callback argument — lets armHopHold stay a plain, stable
  // function while still always firing whatever the most recent hitbox
  // frame decided should happen, not a stale closure from when the hold
  // first started.
  const hopHoldFireRef = useRef<(() => void) | null>(null);

  const clearHopHold = useCallback(() => {
    if (hopHoldTimeoutRef.current) {
      clearTimeout(hopHoldTimeoutRef.current);
      hopHoldTimeoutRef.current = null;
    }
    hopHoldDirectionRef.current = null;
    hopHoldFireRef.current = null;
  }, []);

  const armHopHold = useCallback(
    (direction: 'left' | 'right') => {
      if (hopHoldDirectionRef.current === direction) return; // already counting down for this side
      if (hopHoldTimeoutRef.current) clearTimeout(hopHoldTimeoutRef.current);
      hopHoldDirectionRef.current = direction;
      hopHoldTimeoutRef.current = setTimeout(() => {
        hopHoldTimeoutRef.current = null;
        hopHoldDirectionRef.current = null;
        hopHoldFireRef.current?.();
      }, PAGE_HOP_HOLD_MS);
    },
    []
  );

  // Kept fresh after every render (via the layout effect below, never
  // written during render itself) so the imperative, gesture-scoped
  // listeners further down — added only while a cross-page relocation is
  // in flight, so they can't be ordinary hook-dependency-tracked callbacks
  // — always read current values without needing to resubscribe
  // mid-gesture. Also doubles as the same escape hatch for the manual
  // touch-drag paging further down (committedIndex/pageWidth/slotGapPx/
  // restingTrackOffsetPx), for the same reason: those handlers are attached
  // once and live for the component's lifetime, not re-attached on every
  // render just because a page changed.
  const liveRef = useRef({
    current,
    prev,
    next,
    pages,
    effectiveBreakpoint,
    activeIndex,
    onCreatePage,
    onMoveWidgetToPage,
    onLayoutChange,
    forceGoToIndex,
    committedIndex,
    pageWidth,
    slotGapPx,
    restingTrackOffsetPx,
    showBlankSlot,
    handlePageIndexChange,
  });
  useLayoutEffect(() => {
    liveRef.current = {
      current,
      prev,
      next,
      pages,
      effectiveBreakpoint,
      activeIndex,
      onCreatePage,
      onMoveWidgetToPage,
      onLayoutChange,
      forceGoToIndex,
      committedIndex,
      pageWidth,
      slotGapPx,
      restingTrackOffsetPx,
      showBlankSlot,
      handlePageIndexChange,
    };
    // Confirms an in-flight hop once `current` actually catches up to the
    // page it targeted — see the big comment on dragRef above.
    const state = dragRef.current;
    if (state?.pendingConfirmation && current.kind === 'real' && current.page.id === state.targetPageId) {
      state.pendingConfirmation = false;
    }
  });

  // Shared by wheel and keyboard paging — resolves a step against
  // usePageSlide's own queue/committedIndex (see resolveDeltaTarget), then
  // clamps it into the valid page range before handing it to requestPage,
  // which handles the mid-slide queuing itself. Reads liveRef instead of
  // taking pages/showBlankSlot as closed-over values so it stays
  // referentially stable, letting both gesture listeners attach once
  // instead of resubscribing on every commit.
  const requestDelta = useCallback(
    (delta: number) => {
      const { pages: livePages, showBlankSlot: liveShowBlankSlot } = liveRef.current;
      const target = clampPageIndex(pageSlide.resolveDeltaTarget(delta), livePages.length, liveShowBlankSlot);
      pageSlide.requestPage(target);
    },
    [pageSlide]
  );

  // Once a widget has been handed off to a neighboring page mid-drag (see
  // hopToNeighbor below), there's no native drag on that page to track —
  // this tracks the live cursor ourselves for the whole gesture (same-page
  // or hopped), translating it into grid units on whichever page is now
  // active with the same pixel<->grid math react-grid-layout uses
  // internally, so the widget keeps following the cursor and the user can
  // still choose exactly where to drop it.
  const pendingPointRef = useRef<Point | null>(null);
  const dragRafRef = useRef(false);
  // Holds whichever move/up functions are currently registered on window —
  // captured once, at attach time, purely so the detach side can remove the
  // exact same references (see beginDrag) without the two ends needing to
  // name each other directly.
  const attachedDragListenersRef = useRef<{ move: (e: Event) => void; up: (e: Event) => void } | null>(null);
  // Always points at the latest hopToNeighbor (assigned in the layout
  // effect just below it) so the pointer-move listener created inside
  // beginDrag can trigger a hop without having to reference hopToNeighbor
  // by name from inside its own definition.
  const hopToNeighborRef = useRef<(direction: 'left' | 'right', widgetId: string, w: number, h: number) => void>(
    () => {}
  );

  // A relocated widget's own data (x/y in grid units) still has to update
  // for compaction/persistence to work, but rendering it at that quantized
  // cell position while dragging would visibly snap and desync from the
  // cursor mid-gesture — the exact "changed position" the widget shouldn't
  // do. Instead its real DOM node is hidden (see applyRelocatedPosition)
  // and this floating clone — captured once from its actual on-screen box
  // via getBoundingClientRect the instant the drag starts, so it starts out
  // pixel-identical to the widget it's standing in for — tracks the cursor
  // 1:1 by the grabOffsetX/Y captured at that same moment, for the whole
  // gesture (same-page or hopped). Dropping just removes it and reveals the
  // real widget, already sitting at its final committed position.
  const ghostElRef = useRef<HTMLDivElement | null>(null);

  const createGhost = useCallback((sourceElement: HTMLElement, point: Point) => {
    const rect = sourceElement.getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.className = 'grid-drag-ghost';
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;

    const clone = sourceElement.cloneNode(true) as HTMLElement;
    // Undo the source's own absolute-positioning transform (react-grid-
    // layout's drag styling) — the ghost's own fixed left/top/width/height
    // now does that job, so the clone just needs to fill it.
    clone.style.position = 'static';
    clone.style.transform = 'none';
    clone.style.inset = '0';
    clone.style.margin = '0';
    clone.style.width = '100%';
    clone.style.height = '100%';
    ghost.appendChild(clone);

    document.body.appendChild(ghost);
    ghostElRef.current = ghost;
    document.body.style.cursor = 'grabbing';

    return { grabOffsetX: point.x - rect.left, grabOffsetY: point.y - rect.top };
  }, []);

  const updateGhostPosition = useCallback((point: Point) => {
    const ghost = ghostElRef.current;
    const state = dragRef.current;
    if (!ghost || !state) return;
    ghost.style.left = `${point.x - state.grabOffsetX}px`;
    ghost.style.top = `${point.y - state.grabOffsetY}px`;
  }, []);

  const destroyGhost = useCallback(() => {
    ghostElRef.current?.remove();
    ghostElRef.current = null;
    document.body.style.cursor = '';
  }, []);

  // Reveals whichever widget the last-known relocation state was steering,
  // wherever it currently lives — its own layout write already lands it at
  // the right final spot (see applyRelocatedPosition), this just undoes the
  // display hide that kept it from flashing at that snapped position while
  // the ghost was standing in for it.
  const revealRelocatedWidget = useCallback((widgetId: string) => {
    const el = document.querySelector<HTMLElement>(`.grid-page-slot--active .grid [data-widget-id="${widgetId}"]`);
    if (el) el.style.display = '';
  }, []);

  // The same accent-colored box react-grid-layout shows natively for an
  // in-page drag (.react-grid-item.react-grid-placeholder, styled in
  // grid.scss) — recreated by hand here since there's no native drag on the
  // target page to render one. Reused across frames/hops, only ever
  // re-parented if the grid it belongs in changes.
  const placeholderElRef = useRef<HTMLDivElement | null>(null);

  const ensurePlaceholder = useCallback((gridEl: HTMLElement) => {
    let el = placeholderElRef.current;
    if (!el) {
      el = document.createElement('div');
      el.className = 'react-grid-item react-grid-placeholder';
      el.style.position = 'absolute';
      placeholderElRef.current = el;
    }
    if (el.parentElement !== gridEl) gridEl.appendChild(el);
    return el;
  }, []);

  const destroyPlaceholder = useCallback(() => {
    placeholderElRef.current?.remove();
    placeholderElRef.current = null;
  }, []);

  // Runs on every tracked frame while relocating: moves the ghost to the
  // cursor (the only thing actually visible) and the placeholder to the
  // grid cell it'll land in, hides the real widget wherever it currently
  // renders so its own snapped position never shows through underneath —
  // display:none, not visibility:hidden, since a widget can style its own
  // descendants back to visibility:visible for its own purposes (Orbit's
  // depth-faking planets do exactly this) regardless of what an ancestor
  // says — and writes that snapped x/y to app state anyway, needed for
  // compaction/persistence, just not for anything on screen.
  const applyRelocatedPosition = useCallback((point: Point, isDropping = false) => {
    const state = dragRef.current;
    if (!state) return;
    updateGhostPosition(point);

    // `.grid-page-slot--active` doesn't actually swap onto the target page
    // until the hop's slide settles (state.pendingConfirmation clears — see
    // dragRef's big comment), so until then this selector still
    // resolves to the page being slid AWAY from, which doesn't contain this
    // widget's target-page siblings at all: every query below would just
    // miss, while still paying for a forced layout read
    // (getBoundingClientRect) on every single animation frame, fighting the
    // track's own CSS transition for the main thread for zero visible
    // benefit — this is what actually caused the frame drops and the
    // pushed-aside-widgets preview freezing then jumping once the slide
    // caught up. Skip the whole thing and let the ghost (already
    // repositioned above) carry the cursor on its own meanwhile; a real
    // drop still has to flush through once, even mid-slide, so it's exempt.
    if (state.pendingConfirmation && !isDropping) {
      placeholderElRef.current?.style.setProperty('display', 'none');
      return;
    }

    const { effectiveBreakpoint, pages, pageWidth, onLayoutChange } = liveRef.current;
    const gridEl = document.querySelector<HTMLElement>('.grid-page-slot--active .grid');
    if (!gridEl) return;
    const widgetEl = gridEl.querySelector<HTMLElement>(`[data-widget-id="${state.widgetId}"]`);
    if (widgetEl) widgetEl.style.display = 'none';
    const cols = GRID_COLS[effectiveBreakpoint];
    // gridEl's measured rect reflects .grid-canvas's own drag-shrink CSS
    // transform (see grid.scss's --dragging), so it's the right basis for
    // anything working in CURSOR/viewport space (below) — but calcGridItemPosition's
    // OUTPUT becomes a LOCAL style on elements that are THEMSELVES inside
    // that same scaled ancestor, so feeding it the scaled width would
    // double-apply the shrink visually. Those calls use layoutPositionParams
    // (liveRef's own intrinsic pageWidth, unaffected by the transform)
    // instead — see each call site below.
    const rect = gridEl.getBoundingClientRect();
    const positionParams = buildPositionParams(rect.width, cols);
    const layoutPositionParams = buildPositionParams(pageWidth, cols);
    const targetPage = pages.find((p) => p.id === state.targetPageId);
    const rawItem = targetPage?.layout.find((it) => it.i === state.widgetId);
    if (!targetPage || !rawItem) return;

    // The widget's own height is read live off its current layout entry
    // rather than frozen from state.h (captured once, from the source page,
    // when the drag started) — an auto-expand widget mounted fresh on the
    // target page can settle at a genuinely different height there, and
    // WidgetShell's ResizeObserver keeps correcting rawItem.h for it
    // throughout the drag (see WidgetShell's hidden-element guard for why
    // that's safe to leave running rather than suppressing it). Using a
    // stale frozen height here would under- or over-push whatever's below
    // it, and disagree with whatever height that live correction had
    // already committed — two different "correct" heights for the same
    // widget fighting over the same page's layout is exactly the kind of
    // stale-echo race that trips "Maximum update depth exceeded".
    const liveH = rawItem.h;

    // point is the raw cursor position, not the widget's own top-left — the
    // ghost (the only on-screen stand-in for the dragged widget) is drawn at
    // point minus the grab offset (see updateGhostPosition/createGhost), so
    // the grid cell fed into collision/placement math has to be computed
    // from that same top-left, not the cursor itself. Using the cursor
    // directly here shifted the widget's LOGICAL position down-and-right of
    // where the ghost visually sits by the grab offset (e.g. roughly half
    // the widget's own height/width, when grabbed near its center) — which
    // undershoots how far an existing widget below it needs to be pushed to
    // actually clear the ghost, leaving it only partially out of the way.
    const { x, y } = calcXY(
      positionParams,
      point.y - state.grabOffsetY - rect.top,
      point.x - state.grabOffsetX - rect.left,
      state.w,
      liveH
    );

    // Everything from here down — moveElement, compact, the placeholder's
    // resolved position — is a LOCAL, in-memory preview computed fresh off
    // whatever's currently committed (targetPage.layout via a defensive
    // clone; moveElement mutates whatever it's given). It is NOT written
    // back to React state until the gesture actually ends (isDropping): see
    // the early return below. Every earlier attempt at fixing this
    // relocation's "Maximum update depth exceeded" — a mutation-safety fix,
    // a live-height fix, a static/isDraggable pin — assumed the live
    // per-frame write to page.layout itself was sound and chased what was
    // fighting it. It wasn't: GridLayout mounts on the target page with no
    // native drag of its own ever having started there (this hand-off never
    // goes through RGL's own onDragStart/activeDrag), so its internal
    // reconciliation effect — which normally stands down for the duration of
    // a real same-page drag — stays active throughout, independently
    // recompacting whatever we write and feeding its own result back out
    // through the very same onLayoutChange channel. That's two authors
    // pushing updates through one channel many times a second; no amount of
    // making our own math more correct closes a race that's structural.
    //
    // The live "push other widgets out of the way" visual is instead driven
    // by writing straight to each affected widget's own DOM style below —
    // the exact transform/width/height react-grid-layout's own GridItem
    // would set for that resolved position (see setTransform in the
    // library) — bypassing React/props entirely for the target page, so
    // there's nothing for its reconciliation effect to react to or fight
    // over. It rides the SAME CSS transition every ordinary drag-triggered
    // reflow already uses, so it animates identically. Nothing here needs
    // explicit cleanup: a hop to a different page (or a different peek
    // role) remounts that page's GridPage under a fresh key, discarding
    // this DOM subtree entirely; a normal drop commits the identical
    // resolved layout to React state, which repaints every item with the
    // same values this loop was already showing.
    const clonedLayout = cloneLayout(targetPage.layout);
    const item = getLayoutItem(clonedLayout, state.widgetId);
    if (!item) return;

    const moved = moveElement(clonedLayout, item, x, y, true, false, verticalCompactor.type, cols, false);
    const nextLayout = verticalCompactor.compact(moved, cols);
    const resolvedItem = nextLayout.find((it) => it.i === state.widgetId) ?? item;

    const placeholderEl = ensurePlaceholder(gridEl);
    placeholderEl.style.display = ''; // undo the pendingConfirmation hide above, now that there's somewhere real to show it
    const pos = calcGridItemPosition(layoutPositionParams, resolvedItem.x, resolvedItem.y, state.w, liveH);
    placeholderEl.style.left = `${pos.left}px`;
    placeholderEl.style.top = `${pos.top}px`;
    placeholderEl.style.width = `${pos.width}px`;
    placeholderEl.style.height = `${pos.height}px`;

    for (const otherItem of nextLayout) {
      if (otherItem.i === state.widgetId) continue;
      const otherEl = gridEl.querySelector<HTMLElement>(`[data-widget-id="${otherItem.i}"]`);
      if (!otherEl) continue;
      const otherPos = calcGridItemPosition(layoutPositionParams, otherItem.x, otherItem.y, otherItem.w, otherItem.h);
      otherEl.style.transform = `translate(${otherPos.left}px, ${otherPos.top}px)`;
      otherEl.style.width = `${otherPos.width}px`;
      otherEl.style.height = `${otherPos.height}px`;
    }

    if (!isDropping) return;
    onLayoutChange(effectiveBreakpoint, state.targetPageId, nextLayout);
  }, [updateGhostPosition, ensurePlaceholder]);

  // Ends a widget drag (release, or a safety-net unmount) — either commits
  // its final position, or, if the ghost was released over RemoveDropZone,
  // deletes the widget outright instead.
  const endDrag = useCallback(() => {
    const listeners = attachedDragListenersRef.current;
    if (listeners) {
      window.removeEventListener('mousemove', listeners.move);
      window.removeEventListener('touchmove', listeners.move);
      window.removeEventListener('mouseup', listeners.up);
      window.removeEventListener('touchend', listeners.up);
      attachedDragListenersRef.current = null;
    }
    const state = dragRef.current;
    if (state?.armedForRemove) {
      handleRemove(state.widgetId, state.targetPageId);
    } else {
      // Flush whatever position the cursor was last known to be at before
      // tearing the drag state down. isDropping=true is what makes this
      // call actually commit to React state — every earlier frame this
      // drag only computed a local preview (see applyRelocatedPosition), so
      // this is also the FIRST write for this gesture, landing the dragged
      // widget and anything it pushed out of the way in one atomic step.
      const finalPoint = pendingPointRef.current;
      if (finalPoint) applyRelocatedPosition(finalPoint, true);
      if (state) revealRelocatedWidget(state.widgetId);
    }
    destroyGhost();
    destroyPlaceholder();
    dragRef.current = null;
    pendingPointRef.current = null;
    armLeftRef.current?.classList.remove('grid-page-slot--armed');
    armRightRef.current?.classList.remove('grid-page-slot--armed');
    removeZoneRef.current?.classList.remove('remove-drop-zone--armed');
    clearHopHold();
    setIsDragActive(false);
    setIsMoveDragActive(false);
    unlockGestures();
    // Defensive: if this drag's own hop logic (see hopToNeighbor) somehow
    // left committedIndex pointing past the last real page, land back on it
    // — mirrors the old persistent-edit-mode toggle's own clamp for the
    // same "don't strand the view on a slot that no longer needs to be
    // shown" case.
    const { pages: livePages, committedIndex: liveCommittedIndex, forceGoToIndex: liveForceGoToIndex } = liveRef.current;
    if (liveCommittedIndex >= livePages.length) liveForceGoToIndex(Math.max(0, livePages.length - 1));
  }, [applyRelocatedPosition, revealRelocatedWidget, destroyGhost, destroyPlaceholder, clearHopHold, handleRemove]);

  // Coalesced to at most once per animation frame — a raw mousemove/
  // touchmove can fire far faster than that, and each call already writes
  // through to app state (debounced further downstream before it ever
  // reaches Firestore — see useGridState's write debounce).
  const scheduleRelocatedPositionUpdate = useCallback(
    (point: Point) => {
      pendingPointRef.current = point;
      if (dragRafRef.current) return;
      dragRafRef.current = true;
      requestAnimationFrame(() => {
        dragRafRef.current = false;
        if (pendingPointRef.current) applyRelocatedPosition(pendingPointRef.current);
      });
    },
    [applyRelocatedPosition]
  );

  // Re-checks the hitbox test on every move (not just at entry) so a drag
  // that keeps going can hop across more than one page boundary in a row,
  // and so RemoveDropZone's armed state always reflects where the ghost
  // currently is.
  const handleDragPointerMove = useCallback(
    (event: Event) => {
      const state = dragRef.current;
      if (!state) return;
      const point = getEventPoint(event);
      if (!point) return;
      if (event.cancelable) event.preventDefault();
      scheduleRelocatedPositionUpdate(point);

      const overRemove = isPointInRect(point, removeZoneRef.current?.getBoundingClientRect());
      ghostElRef.current?.classList.toggle('grid-drag-ghost--remove-armed', overRemove);
      removeZoneRef.current?.classList.toggle('remove-drop-zone--armed', overRemove);
      state.armedForRemove = overRemove;

      const { prev, next } = liveRef.current;
      const overLeft = !!prev && isPointInRect(point, armLeftRef.current?.getBoundingClientRect());
      const overRight = !!next && isPointInRect(point, armRightRef.current?.getBoundingClientRect());
      armLeftRef.current?.classList.toggle('grid-page-slot--armed', overLeft);
      armRightRef.current?.classList.toggle('grid-page-slot--armed', overRight);
      if (state.pendingConfirmation) return; // previous hop hasn't landed in a render yet — see dragRef's comment
      const inHitbox = overLeft || overRight;
      if (state.awaitingExit) {
        if (!inHitbox) state.awaitingExit = false; // cursor cleared the zone — a fresh entry can arm again
        clearHopHold();
        return;
      }
      if (!inHitbox) {
        clearHopHold();
        return;
      }
      const direction = overLeft ? 'left' : 'right';
      hopHoldFireRef.current = () => hopToNeighborRef.current(direction, state.widgetId, state.w, state.h);
      armHopHold(direction);
    },
    [scheduleRelocatedPositionUpdate, armHopHold, clearHopHold]
  );

  // Hands a widget off to the peek neighbor on `direction` — fires the
  // instant the cursor enters that neighbor's actual hitbox (after
  // PAGE_HOP_HOLD_MS dwell — see armHopHold), not on drop, and leaves the
  // gesture live so handleDragPointerMove keeps steering the same ghost
  // afterward. The ghost/grab-offset were already captured once, at drag
  // start (see beginDrag below) — every hop just keeps steering that same
  // ghost, so there's nothing left to (re)create here.
  const hopToNeighbor = useCallback((direction: 'left' | 'right', widgetId: string, w: number, h: number) => {
    const { current, prev, next, pages, effectiveBreakpoint, activeIndex, onCreatePage, onMoveWidgetToPage, forceGoToIndex } =
      liveRef.current;
    if (current.kind !== 'real') return;
    const target = direction === 'left' ? prev : next;
    if (!target) return;

    const targetPageId = target.kind === 'real' ? target.page.id : onCreatePage(effectiveBreakpoint);
    // Moving the source page's only widget away empties it — but per
    // withEmptyPageCollapsed, an empty page only actually collapses if
    // nothing inhabited sits after it. A right-drag always lands the
    // widget on whatever occupies the very next page (an existing one, or
    // one freshly created above), which ends up sitting right after the
    // source either way — so the source never collapses on a right-drag.
    // A left-drag doesn't add anything after the source, so it collapses
    // only if the source was already the last page.
    const sourceWillBeDeleted =
      direction === 'left' && current.page.widgets.length === 1 && activeIndex === pages.length - 1;

    dragRef.current = {
      widgetId,
      w,
      h,
      targetPageId,
      awaitingExit: true,
      pendingConfirmation: true,
      armedForRemove: dragRef.current?.armedForRemove ?? false,
      grabOffsetX: dragRef.current?.grabOffsetX ?? 0,
      grabOffsetY: dragRef.current?.grabOffsetY ?? 0,
    };
    onMoveWidgetToPage(widgetId, effectiveBreakpoint, current.page.id, targetPageId);
    forceGoToIndex(direction === 'left' ? activeIndex - 1 : sourceWillBeDeleted ? activeIndex : activeIndex + 1);
  }, []);
  useLayoutEffect(() => {
    hopToNeighborRef.current = hopToNeighbor;
  });

  // Starts a widget drag from a long-press hand-off (see WidgetShell's
  // useLongPress) — always begins on the CURRENT (source) page; hopping
  // onto a neighbor is a separate, later event (see hopToNeighbor above)
  // triggered once the cursor dwells in a peek neighbor's hitbox, not
  // something a drag has to already be doing to start.
  const beginDrag = useCallback(
    (widgetId: string, point: Point, sourceElement: HTMLElement) => {
      const { current } = liveRef.current;
      if (current.kind !== 'real') return;
      const rawItem = current.page.layout.find((item) => item.i === widgetId);
      if (!rawItem) return;

      const grabOffset = createGhost(sourceElement, point);
      dragRef.current = {
        widgetId,
        w: rawItem.w,
        h: rawItem.h,
        targetPageId: current.page.id,
        awaitingExit: false,
        pendingConfirmation: false,
        armedForRemove: false,
        ...grabOffset,
      };
      setIsDragActive(true);
      setIsMoveDragActive(true);
      lockGestures();

      if (!attachedDragListenersRef.current) {
        const move = handleDragPointerMove;
        const up = endDrag;
        attachedDragListenersRef.current = { move, up };
        window.addEventListener('mousemove', move);
        window.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('mouseup', up);
        window.addEventListener('touchend', up);
      }
    },
    [createGhost, handleDragPointerMove, endDrag]
  );

  // Safety net: release the gesture-scoped window listeners if this
  // component unmounts mid-drag (e.g. navigating away). Deliberately NOT
  // `useEffect(() => endDrag, [endDrag])` — endDrag depends on handleRemove,
  // which depends on `pages`, which gets a new reference on almost any
  // Redux update (including totally unrelated ones, e.g. a different
  // widget's auto-expand height settling). That form doesn't mean "call
  // endDrag on unmount" — it means "every time endDrag's reference changes,
  // call the PREVIOUS endDrag as this effect's own cleanup", which was
  // tearing down a real, in-progress drag (dragRef.current = null,
  // setIsDragActive(false)) the instant anything touched Redux, mid-gesture,
  // with the user's finger still down — the "edit mode flashes and
  // immediately reverts" bug. Reading the latest endDrag off a ref, and
  // only ever calling it from THIS effect's own cleanup (which only runs on
  // actual unmount, since the effect itself has no dependencies), fixes it.
  const endDragRef = useRef(endDrag);
  useLayoutEffect(() => {
    endDragRef.current = endDrag;
  });
  useEffect(() => () => endDragRef.current(), []);

  // --- Resize: a resize handle's own press is a fresh, unambiguous gesture
  // (it only exists once a widget's menu is already open — see
  // ResizeHandle/WidgetShell), so unlike a drag it never needs a long-press
  // hand-off. No ghost/placeholder/cross-page hop either — the widget
  // resizes in place, using the same local-preview-then-commit-on-drop
  // technique as the drag engine above: a fresh w/h/x is computed and
  // compacted every frame, written straight to DOM, only committed to
  // React state (onLayoutChange) once, on release.
  const resizeRef = useRef<{
    widgetId: string;
    pageId: string;
    corner: ResizeCorner;
    startPoint: Point;
    startWidthPx: number;
    startHeightPx: number;
    startX: number;
    startY: number;
    startW: number;
    minW: number;
    minH: number;
  } | null>(null);
  const attachedResizeListenersRef = useRef<{ move: (e: Event) => void; up: (e: Event) => void } | null>(null);
  const pendingResizePointRef = useRef<Point | null>(null);
  const resizeRafRef = useRef(false);
  const pendingResizeLayoutRef = useRef<Layout | null>(null);

  const applyResizePosition = useCallback((point: Point, isDropping = false) => {
    const state = resizeRef.current;
    if (!state) return;
    const { effectiveBreakpoint, pages, pageWidth, onLayoutChange } = liveRef.current;
    const targetPage = pages.find((p) => p.id === state.pageId);
    const gridEl = document.querySelector<HTMLElement>('.grid-page-slot--active .grid');
    const rawItem = targetPage?.layout.find((it) => it.i === state.widgetId);
    if (!targetPage || !gridEl || !rawItem) return;

    const cols = GRID_COLS[effectiveBreakpoint];
    // See applyRelocatedPosition's identical split: positionParams (measured,
    // reflects .grid-canvas's drag-shrink transform) for anything working in
    // cursor/viewport space (calcWH below); layoutPositionParams (intrinsic
    // pageWidth) for calcGridItemPosition calls that set LOCAL styles on
    // elements inside that same scaled ancestor.
    const rect = gridEl.getBoundingClientRect();
    const positionParams = buildPositionParams(rect.width, cols);
    const layoutPositionParams = buildPositionParams(pageWidth, cols);

    const dx = point.x - state.startPoint.x;
    const dy = point.y - state.startPoint.y;
    const isWest = state.corner === 'sw' || state.corner === 'w';
    const isSouth = state.corner === 'se' || state.corner === 'sw';
    const rawWidthPx = Math.max(1, isWest ? state.startWidthPx - dx : state.startWidthPx + dx);
    const rawHeightPx = Math.max(1, isSouth ? state.startHeightPx + dy : state.startHeightPx);

    // calcWH does the pixel->grid-unit rounding/clamping (relaxing the
    // width clamp against the full column count, not cols - x, for a
    // west-anchored handle — see its own doc comment); the x shift for a
    // west handle is then just "keep the right edge fixed" in grid units,
    // mirroring react-grid-layout's own resizeWest.
    const { w: wholeW, h: wholeH } = calcWH(positionParams, rawWidthPx, rawHeightPx, state.startX, state.startY, state.corner);
    const w = Math.max(state.minW, wholeW);
    const h = isSouth ? Math.max(state.minH, wholeH) : rawItem.h;
    const x = isWest ? Math.max(0, state.startX + state.startW - w) : state.startX;

    // Same local-preview technique as applyRelocatedPosition above: cloned,
    // compacted, written straight to DOM every frame; only committed to
    // React state (onLayoutChange) once, on drop.
    const clonedLayout = cloneLayout(targetPage.layout);
    const item = getLayoutItem(clonedLayout, state.widgetId);
    if (!item) return;
    item.x = x;
    item.w = w;
    item.h = h;
    const nextLayout = verticalCompactor.compact(clonedLayout, cols);
    const resolvedItem = nextLayout.find((it) => it.i === state.widgetId) ?? item;

    const widgetEl = gridEl.querySelector<HTMLElement>(`[data-widget-id="${state.widgetId}"]`);
    if (widgetEl) {
      const pos = calcGridItemPosition(layoutPositionParams, resolvedItem.x, resolvedItem.y, resolvedItem.w, resolvedItem.h);
      widgetEl.style.transform = `translate(${pos.left}px, ${pos.top}px)`;
      widgetEl.style.width = `${pos.width}px`;
      widgetEl.style.height = `${pos.height}px`;
    }
    for (const otherItem of nextLayout) {
      if (otherItem.i === state.widgetId) continue;
      const otherEl = gridEl.querySelector<HTMLElement>(`[data-widget-id="${otherItem.i}"]`);
      if (!otherEl) continue;
      const otherPos = calcGridItemPosition(layoutPositionParams, otherItem.x, otherItem.y, otherItem.w, otherItem.h);
      otherEl.style.transform = `translate(${otherPos.left}px, ${otherPos.top}px)`;
      otherEl.style.width = `${otherPos.width}px`;
      otherEl.style.height = `${otherPos.height}px`;
    }

    pendingResizeLayoutRef.current = nextLayout;
    if (!isDropping) return;
    onLayoutChange(effectiveBreakpoint, state.pageId, nextLayout);
  }, []);

  const scheduleResizeUpdate = useCallback(
    (point: Point) => {
      pendingResizePointRef.current = point;
      if (resizeRafRef.current) return;
      resizeRafRef.current = true;
      requestAnimationFrame(() => {
        resizeRafRef.current = false;
        if (pendingResizePointRef.current) applyResizePosition(pendingResizePointRef.current);
      });
    },
    [applyResizePosition]
  );

  const endResize = useCallback(() => {
    const listeners = attachedResizeListenersRef.current;
    if (listeners) {
      window.removeEventListener('mousemove', listeners.move);
      window.removeEventListener('touchmove', listeners.move);
      window.removeEventListener('mouseup', listeners.up);
      window.removeEventListener('touchend', listeners.up);
      attachedResizeListenersRef.current = null;
    }
    const finalPoint = pendingResizePointRef.current;
    if (finalPoint) applyResizePosition(finalPoint, true);
    resizeRef.current = null;
    pendingResizePointRef.current = null;
    pendingResizeLayoutRef.current = null;
    setIsDragActive(false);
    unlockGestures();
  }, [applyResizePosition]);

  const handleResizeMove = useCallback(
    (event: Event) => {
      if (!resizeRef.current) return;
      const point = getEventPoint(event);
      if (!point) return;
      if (event.cancelable) event.preventDefault();
      scheduleResizeUpdate(point);
    },
    [scheduleResizeUpdate]
  );

  const beginResize = useCallback(
    (widgetId: string, corner: ResizeCorner, point: Point) => {
      const { current, effectiveBreakpoint } = liveRef.current;
      if (current.kind !== 'real') return;
      const widget = current.page.widgets.find((w) => w.id === widgetId);
      const rawItem = current.page.layout.find((item) => item.i === widgetId);
      const gridEl = document.querySelector<HTMLElement>('.grid-page-slot--active .grid');
      if (!widget || !rawItem || !gridEl) return;

      const cols = GRID_COLS[effectiveBreakpoint];
      const rect = gridEl.getBoundingClientRect();
      const positionParams = buildPositionParams(rect.width, cols);
      const box = calcGridItemPosition(positionParams, rawItem.x, rawItem.y, rawItem.w, rawItem.h);
      const minSize = findWidgetDefinition(widget.type)?.minSize ?? DEFAULT_WIDGET_MIN_SIZE;

      resizeRef.current = {
        widgetId,
        pageId: current.page.id,
        corner,
        startPoint: point,
        startWidthPx: box.width,
        startHeightPx: box.height,
        startX: rawItem.x,
        startY: rawItem.y,
        startW: rawItem.w,
        minW: Math.min(minSize.w, cols),
        minH: minSize.h,
      };
      setIsDragActive(true);
      lockGestures();

      if (!attachedResizeListenersRef.current) {
        const move = handleResizeMove;
        const up = endResize;
        attachedResizeListenersRef.current = { move, up };
        window.addEventListener('mousemove', move);
        window.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('mouseup', up);
        window.addEventListener('touchend', up);
      }
    },
    [handleResizeMove, endResize]
  );

  // Same fix as endDrag's own safety-net effect above, and for the exact
  // same reason (endResize -> ... -> pages changing on any unrelated Redux
  // update, tearing down an in-progress resize mid-gesture).
  const endResizeRef = useRef(endResize);
  useLayoutEffect(() => {
    endResizeRef.current = endResize;
  });
  useEffect(() => () => endResizeRef.current(), []);

  const handleWidgetHeightsChange = useCallback(
    (pageId: string, patches: Array<{ id: string; h: number }>) =>
      onWidgetHeightsChange(effectiveBreakpoint, pageId, patches),
    [onWidgetHeightsChange, effectiveBreakpoint]
  );

  const handleLayoutChange = useCallback(
    (pageId: string, layout: Layout) => onLayoutChange(effectiveBreakpoint, pageId, layout),
    [effectiveBreakpoint, onLayoutChange]
  );

  // --- Swipe / wheel / keyboard paging ---
  // Touch paging tracks the finger 1:1 (like iOS's springboard) rather than
  // committing on a single detected swipe gesture: the track's transform is
  // driven imperatively off touchmove deltas (bypassing React entirely, same
  // pattern as the cross-page drag ghost above) so it can follow the finger
  // at 60fps without a render in between, then only on release does it
  // either hand off to requestDelta (a fast flick, or a slow drag that crossed
  // SWIPE_COMMIT_FRACTION of a page width — see handleTouchEnd) or animate
  // back to rest itself. liveRef (declared above for the relocation gesture)
  // supplies the current committedIndex/pageWidth/etc. without needing these
  // handlers to be torn down and re-attached on every page change.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let touchStart: { x: number; y: number; t: number } | null = null;
    let touchLocked: boolean | null = null;
    let rawDx = 0;

    // Cancels any programmatic slide still in flight so the drag starts from
    // a fully-settled base, then takes over the track's transform by hand —
    // not via usePageSlide's own applyInstant no-transition toggle, which
    // removes itself again one frame later (via rAF) and would start easing
    // every subsequent touchmove frame instead of snapping straight to the
    // finger.
    const beginSwipeDrag = () => {
      pageSlide.resetToCommitted();
      trackRef.current?.classList.add('grid-page-track--no-transition');
    };

    const endSwipeDrag = () => {
      touchStart = null;
      touchLocked = null;
      rawDx = 0;
    };

    // Animates the track back to its resting transform under its own steam
    // (no page change committed) — duration scales down for a barely-dragged
    // release so cancelling a small nudge snaps back quickly rather than
    // taking the same time as a full page slide.
    const snapBack = (fromDx: number) => {
      const track = trackRef.current;
      if (!track) return;
      const fraction = Math.min(1, Math.abs(fromDx) / (liveRef.current.pageWidth || 1));
      const duration = Math.max(80, PAGE_SLIDE_MS * fraction);
      track.style.transitionDuration = `${duration}ms`;
      track.classList.remove('grid-page-track--no-transition');
      track.style.transform = `translateX(${liveRef.current.restingTrackOffsetPx}px)`;
      waitForTransitionEnd(track, 'transform', duration + 50, () => {
        track.style.transitionDuration = '';
      });
    };

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      touchStart = { x: touch.clientX, y: touch.clientY, t: Date.now() };
      touchLocked = null;
      rawDx = 0;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      // dragRef: a widget drag (same-page or hopped) is already steering
      // the view. areGesturesLocked: some other gesture (a widget's own
      // long-press/menu — see useLongPress — or, today, dragging a task/
      // subtask row — see gestureLock.ts) has claimed this touch instead;
      // without this, the drag's own touchmove deltas were easily big
      // enough to also trip this handler's lock-detection below, paging
      // the whole track out from under the gesture actually using it.
      if (!touchStart || !touch || dragRef.current || resizeRef.current || areGesturesLocked()) return;
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;
      if (touchLocked === null && Math.abs(dx) + Math.abs(dy) > 10) {
        touchLocked = Math.abs(dx) > Math.abs(dy) * SWIPE_DIRECTION_LOCK_RATIO;
        if (touchLocked) beginSwipeDrag();
      }
      if (!touchLocked) return;
      event.preventDefault();
      rawDx = dx;

      const { next, prev, restingTrackOffsetPx } = liveRef.current;
      const hasTarget = dx < 0 ? !!next : !!prev;
      const appliedDx = hasTarget ? dx : rubberBand(dx);
      const track = trackRef.current;
      if (track) track.style.transform = `translateX(${restingTrackOffsetPx + appliedDx}px)`;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      const start = touchStart;
      if (!start || !touch || !touchLocked) {
        endSwipeDrag();
        return;
      }
      const duration = Date.now() - start.t;
      const { next, prev, pageWidth } = liveRef.current;
      const hasTarget = rawDx < 0 ? !!next : !!prev;
      const shouldCommit =
        hasTarget &&
        ((Math.abs(rawDx) >= SWIPE_DISTANCE_PX && duration <= SWIPE_MAX_DURATION_MS) ||
          Math.abs(rawDx) >= pageWidth * SWIPE_COMMIT_FRACTION);

      if (shouldCommit && tryClaimPageChange(PAGE_CHANGE_COOLDOWN_MS)) {
        trackRef.current?.classList.remove('grid-page-track--no-transition');
        requestDelta(rawDx < 0 ? 1 : -1);
      } else {
        snapBack(rawDx);
      }
      endSwipeDrag();
    };

    const handleTouchCancel = () => {
      if (touchLocked) snapBack(rawDx);
      endSwipeDrag();
    };

    let wheelAccumulated = 0;

    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return; // predominantly vertical — let it scroll/zoom normally
      event.preventDefault();

      wheelAccumulated += event.deltaX;
      if (Math.abs(wheelAccumulated) >= WHEEL_SWIPE_THRESHOLD) {
        const direction = wheelAccumulated > 0 ? 1 : -1;
        wheelAccumulated = 0;
        if (tryClaimPageChange(PAGE_CHANGE_COOLDOWN_MS)) requestDelta(direction);
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    el.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchCancel);
      el.removeEventListener('wheel', handleWheel);
    };
    // Mounts once and reads everything live off liveRef/refs instead — see
    // the comment atop this effect — so a page/index change doesn't tear
    // down and re-attach these listeners mid-gesture. pageSlide.resetToCommitted
    // itself is stable (see its useCallback in usePageSlide.ts) even though
    // the pageSlide object it's read off isn't — listing the whole object
    // here would defeat that and re-attach on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, requestDelta, pageSlide.resetToCommitted]);

  // Works in both edit and view mode — clampPageIndex (inside requestDelta)
  // already no-ops when there's nowhere to go, so no extra guard is needed.
  // No cooldown here (unlike wheel/touch): a held arrow key's OS-level
  // repeat is rate-limited by requestPage's own bounded queue (see
  // usePageSlide.ts / pageSlideMachine.ts), the same way a rapid burst of
  // discrete dot/peek clicks is — a wall-clock cooldown on top would just
  // drop legitimate rapid presses instead of queuing them.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      requestDelta(event.key === 'ArrowLeft' ? -1 : 1);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [requestDelta]);

  // --- Canvas context menu: right-click (desktop) or long-press (mobile)
  // on the active page's own empty background — bails if the press landed
  // on a widget (its own long-press/right-click takes precedence there).
  // "Add widget" opens AddWidgetModal (reused unmodified from the old
  // toolbar); "Preview as" is CanvasContextMenu's own submenu.
  const [isAddWidgetModalOpen, setIsAddWidgetModalOpen] = useState(false);
  const [canvasMenuPosition, setCanvasMenuPosition] = useState<Point | null>(null);
  const closeCanvasMenu = useCallback(() => setCanvasMenuPosition(null), []);
  useCloseMenuOnOutsideClick(!!canvasMenuPosition, closeCanvasMenu);

  const handleAddWidgetSelect = useCallback(
    (type: string) => {
      const { current, effectiveBreakpoint: liveEffectiveBreakpoint, onCreatePage } = liveRef.current;
      const pageId = current.kind === 'real' ? current.page.id : onCreatePage(liveEffectiveBreakpoint);
      onAddWidget(type, liveEffectiveBreakpoint, pageId);
      setIsAddWidgetModalOpen(false);
    },
    [onAddWidget]
  );

  const canvasLongPress = useLongPress({
    // This listener sits on .grid-page-slot-content, an ANCESTOR of every
    // widget on the active page — a long-press starting on a widget bubbles
    // up and arms this timer too, alongside that widget's own. Without this
    // check both fire at ~500ms and race ContextMenu's singleton slot; this
    // one, wired up via the bubble phase (so scheduled a beat after the
    // widget's own), reliably wins and immediately closes the widget's menu
    // the instant it opens — the "long-press flashes then closes itself"
    // bug. Mirrors the identical check on the onContextMenu handler below.
    onLongPress: (point, event) => {
      if ((event.target as HTMLElement).closest('.grid-widget')) return;
      setCanvasMenuPosition(point);
    },
  });

  // Shared by both placements below (only one is ever non-null at a time,
  // per slideDirection). Forward appends it as a normal trailing flex child
  // — that doesn't disturb prev/current/next's own flow positions (nothing
  // precedes them), so the existing offset math above still applies
  // unchanged and the track's shared transform carries it along for free.
  // Backward can't use the same trick: a LEADING flex child WOULD shift
  // prev/current/next's flow positions by one slot, and "fixing" the offset
  // math to compensate would cancel out the very transform-value change the
  // CSS transition needs in order to animate at all (the sibling's own
  // position shift is instant, not eased) — collapsing the slide into a
  // snap. Taking it out of flow with an absolute left instead means it
  // still inherits the track's transform (so it slides along identically)
  // without touching prev/current/next's positions at all.
  const lookaheadSlot = lookaheadPage ? (
    <div
      // Keyed the SAME as the prev/active/next slots below (no ":lookahead"
      // suffix) — this page is about to be promoted straight into the prev
      // or next role once the slide settles (see the effect above that nulls
      // lookaheadPage out the instant displayedIndex catches up), and a
      // matching key is what lets React treat that hand-off as an in-place
      // update (move + prop change) instead of unmounting this whole subtree
      // and mounting a fresh one under the prev/next key a frame later. That
      // unmount/remount is what used to read as a jitter/reload on every
      // ordinary page swipe — every widget re-measuring from scratch, any
      // CSS animation inside them (e.g. Orbit) restarting from 0%.
      key={`${effectiveBreakpoint}:${lookaheadSignature}`}
      className={`grid-page-slot grid-page-slot--peek grid-page-slot--incoming${lookaheadVisible ? ' grid-page-slot--incoming-visible' : ''}${isDragActive ? ' grid-page-slot--dragging' : ''}`}
      style={
        slideDirection < 0
          ? { width: pageWidth, position: 'absolute', top: 0, left: -(pageWidth + slotGapPx) }
          : { width: pageWidth }
      }
    >
      <div className="grid-page-slot-content grid-page-slot-content--inert">
        {lookaheadPage.kind === 'real' ? (
          <GridPage
            // Keyed by page identity alone, matching the prev/current/next
            // GridPages below (and their own outer slots) — a page revealed
            // by the overshoot here is the same page.id that'll occupy the
            // next/prev role once the slide settles, so this lets that same
            // GridPage instance (react-grid-layout, every widget, all their
            // measurement effects) carry across the role change instead of
            // unmounting and remounting from scratch, which is what read as
            // jitter/freeze on every page switch.
            key={`${effectiveBreakpoint}:${lookaheadPage.page.id}`}
            page={lookaheadPage.page}
            effectiveBreakpoint={effectiveBreakpoint}
            isSimulating={false}
            gridWidth={pageWidth}
            onWidgetHeightsChange={handleWidgetHeightsChange}
          />
        ) : (
          <BlankPagePane variant="peek" />
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="grid-canvas" ref={containerRef}>
      {mounted && (
        <div className={isMoveDragActive ? 'grid-page-viewport grid-page-viewport--drag-shrink' : 'grid-page-viewport'}>
          <div
            ref={trackRef}
            className="grid-page-track"
            style={{ transform: `translateX(${trackOffsetPx}px)`, gap: slotGapPx }}
          >
            {slideDirection < 0 && lookaheadSlot}

            {prev && (
              <div
                // Keyed by page identity alone (no role prefix) so a page
                // that changes role — e.g. this same page being promoted
                // from a peeking neighbor to the active page — keeps the
                // SAME DOM node across that change (React matches by key
                // across this whole prev/active/next children list, not by
                // JSX position), letting its CSS transitions (the
                // border/outline fade — see grid.scss) carry through
                // instead of restarting from a fresh element. The
                // prevSignature/nextSignature-keyed reflow fix below still
                // separately guards against the stale-flex-layout Chromium
                // bug this used to dodge by forcing a fresh node every time.
                key={`${effectiveBreakpoint}:${prev.kind === 'real' ? prev.page.id : 'blank'}`}
                className={`grid-page-slot grid-page-slot--peek${isDragActive ? ' grid-page-slot--dragging' : ''}${isPrevCommitted ? ' grid-page-slot--committed' : ''}`}
                ref={armLeftRef}
                onClick={() => handlePeekClick(activeIndex - 1)}
                style={{ width: pageWidth }}
              >
                <div className="grid-page-slot-content grid-page-slot-content--inert">
                  {prev.kind === 'real' ? (
                    <GridPage
                      // Page identity alone (see lookahead's GridPage above)
                      // — lets this instance survive a role change (e.g.
                      // promoting to active) instead of remounting.
                      key={`${effectiveBreakpoint}:${prev.page.id}`}
                      page={prev.page}
                      effectiveBreakpoint={effectiveBreakpoint}
                      isSimulating={false}
                      gridWidth={pageWidth}
                      onWidgetHeightsChange={handleWidgetHeightsChange}
                    />
                  ) : (
                    <BlankPagePane variant="peek" />
                  )}
                </div>
              </div>
            )}

            <div
              ref={activeSlotRef}
              key={`${effectiveBreakpoint}:${current.kind === 'real' ? current.page.id : 'blank'}`}
              className={`grid-page-slot grid-page-slot--active${isDragActive ? ' grid-page-slot--dragging' : ''}${isCurrentCommitted ? ' grid-page-slot--committed' : ''}${isSimulating ? ' grid-page-slot--simulating' : ''}`}
              style={{ width: pageWidth }}
            >
              {/* Same .grid-page-slot-content depth as the peek/lookahead
                  slots (without --inert, so widgets stay clickable) — keeps
                  <GridPage> one level deep under every role so its key
                  actually gets matched across a peek<->active transition
                  instead of the depth mismatch forcing a remount. Also the
                  trigger surface for the canvas context menu (Add widget /
                  Preview as) — bails if the press/click landed on a widget,
                  whose own long-press/right-click takes precedence. */}
              <div
                className="grid-page-slot-content"
                onMouseDown={canvasLongPress.onMouseDown}
                onTouchStart={canvasLongPress.onTouchStart}
                onContextMenu={(event) => {
                  if ((event.target as HTMLElement).closest(`.grid-widget, ${WIDGET_GESTURE_SKIP_SELECTOR}`)) return;
                  event.preventDefault();
                  setCanvasMenuPosition({ x: event.clientX, y: event.clientY });
                }}
              >
                {current.kind === 'real' ? (
                  <GridPage
                    // Page identity alone (see lookahead's GridPage above) —
                    // lets this instance survive a role change (e.g. demoting
                    // to a peek neighbor) instead of remounting.
                    key={`${effectiveBreakpoint}:${current.page.id}`}
                    page={current.page}
                    effectiveBreakpoint={effectiveBreakpoint}
                    isSimulating={isSimulating}
                    gridWidth={pageWidth}
                    softLimitRows={softLimitRows}
                    onLayoutChange={handleLayoutChange}
                    onUpdateWidget={handleUpdateWidget}
                    onRemoveWidget={handleRemove}
                    onWidgetHeightsChange={handleWidgetHeightsChange}
                    onWidgetDragStart={beginDrag}
                    onWidgetResizeStart={beginResize}
                  />
                ) : isSimulating ? (
                  // Mirrors GridPage's own .grid-preview-frame wrapping for a
                  // real page — without it, the blank placeholder has no
                  // element for .grid-page-slot--simulating's CSS (see
                  // grid.scss) to paint the "being edited" background/outline
                  // onto, since that treatment lives on .grid-preview-frame
                  // rather than the (real-width) slot while simulating.
                  <div className="grid-preview-frame" style={{ width: pageWidth }}>
                    <BlankPagePane variant="current" />
                  </div>
                ) : (
                  // Purely a placeholder — the blank page only ever becomes
                  // real via dragging a widget onto it (drag-to-edge hop,
                  // above), never by clicking this pane itself.
                  <BlankPagePane variant="current" />
                )}
              </div>
            </div>

            {next && (
              <div
                // See the prev slot's comment above for why this is keyed
                // by page identity alone.
                key={`${effectiveBreakpoint}:${next.kind === 'real' ? next.page.id : 'blank'}`}
                className={`grid-page-slot grid-page-slot--peek${isDragActive ? ' grid-page-slot--dragging' : ''}${isNextCommitted ? ' grid-page-slot--committed' : ''}`}
                ref={armRightRef}
                onClick={() => handlePeekClick(activeIndex + 1)}
                style={{ width: pageWidth }}
              >
                <div className="grid-page-slot-content grid-page-slot-content--inert">
                  {next.kind === 'real' ? (
                    <GridPage
                      // Page identity alone (see lookahead's GridPage above)
                      // — lets this instance survive a role change (e.g.
                      // promoting to active) instead of remounting.
                      key={`${effectiveBreakpoint}:${next.page.id}`}
                      page={next.page}
                      effectiveBreakpoint={effectiveBreakpoint}
                      isSimulating={false}
                      gridWidth={pageWidth}
                      onWidgetHeightsChange={handleWidgetHeightsChange}
                    />
                  ) : (
                    <BlankPagePane variant="peek" />
                  )}
                </div>
              </div>
            )}

            {slideDirection > 0 && lookaheadSlot}
          </div>
        </div>
      )}

      {isMoveDragActive && <RemoveDropZone ref={removeZoneRef} />}

      <CanvasContextMenu
        position={canvasMenuPosition}
        onClose={closeCanvasMenu}
        onAddWidget={() => setIsAddWidgetModalOpen(true)}
        previewBreakpoint={previewBreakpoint}
        allowedBreakpoints={allowedBreakpoints}
        onPreviewBreakpointChange={onPreviewBreakpointChange}
      />

      <AddWidgetModal
        isOpen={isAddWidgetModalOpen}
        onClose={() => setIsAddWidgetModalOpen(false)}
        onSelect={handleAddWidgetSelect}
      />
    </div>
  );
}

export default forwardRef(Grid);
