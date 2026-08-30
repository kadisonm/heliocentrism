'use client';

import { calcGridItemPosition, calcXY, cloneLayout, getLayoutItem, moveElement, useContainerWidth, verticalCompactor } from 'react-grid-layout';
import type { Layout, LayoutItem } from 'react-grid-layout';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  DESKTOP_PAGE_CHANGE_COOLDOWN_MS,
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
import { areGesturesLocked } from '../../lib/gestureLock';
import { clampPageIndex } from '../../lib/grid/pageNavigation';
import { tryClaimPageChange } from '../../lib/grid/pageChangeCooldown';
import BlankPagePane from './BlankPagePane';
import GridPage from './GridPage';
import { usePageNavigation } from './usePageNavigation';
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

// Pulls a client point out of either a mouse or touch event — react-grid-
// layout's onDrag hands back the raw DOM event, which is one or the other
// depending on input device.
function getEventPoint(event: Event): { x: number; y: number } | null {
  if (typeof MouseEvent !== 'undefined' && event instanceof MouseEvent) {
    return { x: event.clientX, y: event.clientY };
  }
  const touchEvent = event as TouchEvent;
  const touch = touchEvent.touches?.[0] ?? touchEvent.changedTouches?.[0];
  return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

// A drag-to-edge hop yanks the dragged widget's DOM node out from under
// react-grid-layout's OWN native drag on the source page (see beginRelocation
// below) mid-gesture — the widget moves to a different page's `widgets`
// array, unmounting it. react-draggable's DraggableCore tears down its own
// document-level move/stop listeners on unmount (componentWillUnmount)
// without ever firing them, so its onStop callback — which is what clears
// react-grid-layout's internal activeDrag state — never runs. Left alone,
// that leaves the source page's native placeholder box stuck on screen
// permanently (its rendering is driven straight off activeDrag) AND stops
// that GridLayout instance from ever resyncing its layout against
// prop/children changes again (its own resync effect bails out early
// whenever activeDrag is set) — for as long as it stays mounted, which,
// since GridPage survives a peek<->active role change instead of
// remounting, can be indefinitely.
//
// Dispatching a synthetic stop event on the source element's own document
// BEFORE the unmount — while the node and DraggableCore's listeners are
// still live — lets it complete its own stop sequence normally instead,
// exactly as if the gesture had ended right here. Reuses the real Touch
// object off the original event (rather than constructing one) since
// DraggableCore matches stop events back to the drag they started by the
// touch's own identifier.
function endNativeDrag(sourceElement: HTMLElement, nativeEvent: Event) {
  const doc = sourceElement.ownerDocument;
  if (typeof MouseEvent !== 'undefined' && nativeEvent instanceof MouseEvent) {
    doc.dispatchEvent(
      new MouseEvent('mouseup', { clientX: nativeEvent.clientX, clientY: nativeEvent.clientY, bubbles: true, cancelable: true })
    );
    return;
  }
  const touchEvent = nativeEvent as TouchEvent;
  const touch = touchEvent.touches?.[0] ?? touchEvent.changedTouches?.[0];
  if (!touch) return;
  doc.dispatchEvent(
    new TouchEvent('touchend', { changedTouches: [touch], targetTouches: [], touches: [], bubbles: true, cancelable: true })
  );
}

function isPointInRect(point: { x: number; y: number }, rect: DOMRect | undefined): boolean {
  if (!rect) return false;
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

type GridProps = {
  breakpoints: Record<DashboardBreakpoint, DashboardBreakpointState>;
  isEditMode: boolean;
  activeBreakpoint: DashboardBreakpoint;
  // The device's own real tier (from useDeviceTier), distinct from
  // activeBreakpoint (which in edit mode can be switched to preview a
  // *different* tier). Used to tell "genuinely simulating another device"
  // apart from "editing the tier you're actually on" — see isSimulating below.
  deviceTier: DashboardBreakpoint;
  activePageIndex: Record<DashboardBreakpoint, number>;
  onPageIndexChange: (breakpoint: DashboardBreakpoint, index: number) => void;
  onLayoutChange: (breakpoint: DashboardBreakpoint, pageId: string, layout: Layout) => void;
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

export default function Grid({
  breakpoints,
  isEditMode,
  activeBreakpoint,
  deviceTier,
  activePageIndex,
  onPageIndexChange,
  onLayoutChange,
  onUpdateWidget,
  onRemoveWidget,
  onWidgetHeightsChange,
  onCreatePage,
  onMoveWidgetToPage,
}: GridProps) {
  const { width, containerRef, mounted } = useContainerWidth();

  // Skip the fixed preview width when editing your own actual tier (not
  // simulating another) — real devices can be narrower than the simulated
  // width, which would otherwise overflow the screen.
  const isSimulating = isEditMode && activeBreakpoint !== deviceTier;

  // Each breakpoint owns its full page set, swapped wholesale rather than
  // using react-grid-layout's built-in breakpoint switching. View mode keys
  // off deviceTier (window width), not measured container width, to avoid a
  // feedback loop where height-driven scrollbars change the width.
  const effectiveBreakpoint = isEditMode ? activeBreakpoint : deviceTier;
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
  const [displayedIndex, setDisplayedIndex] = useState(committedIndex);
  const slideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Exiting edit mode flips isEditMode (and so every page's own chrome —
  // drag handles, geometry, etc.) instantly, straight away. But if
  // displayedIndex is still lagging on the blank "create new page" slot
  // (index === pages.length — see the committedIndex/displayedIndex
  // comment above) when that happens, page.tsx has already clamped
  // committedIndex down to the last real page in the very same commit —
  // this is what keeps the blank slot itself in the virtual page set for
  // exactly as long as that slide-back is still playing, instead of
  // vanishing out from under it before the animation even gets a chance to
  // run. Once displayedIndex catches up, this goes false right along with
  // isEditMode and the blank slot drops out for good.
  const showBlankSlot = isEditMode || displayedIndex === pages.length;

  const { activeIndex, current, prev, next, goToIndex, goToDelta, virtualPages } = usePageNavigation(
    pages,
    showBlankSlot,
    displayedIndex,
    handlePageIndexChange
  );

  // Clicking a peeking neighbor is a direct, single-shot user navigation
  // gesture, same as keyboard/dots — shares that shorter desktop cooldown
  // (see lib/grid/pageChangeCooldown.ts), not the longer wheel/swipe one.
  const handlePeekClick = useCallback(
    (index: number) => {
      if (tryClaimPageChange(DESKTOP_PAGE_CHANGE_COOLDOWN_MS)) goToIndex(index);
    },
    [goToIndex]
  );

  // Identifies a slot by its content (page id, or 'blank'/'none') rather
  // than the prev/current/next/committed objects themselves — those are
  // fresh references whenever usePageNavigation rebuilds its virtual page
  // list, which would otherwise read as "changed" even when the actual
  // page occupying a slot hasn't.
  const slotSignature = (vp: typeof prev) => (vp ? (vp.kind === 'real' ? vp.page.id : 'blank') : 'none');

  // Which page just got committed as active (e.g. a widget-drag hop's own
  // goToIndex, or a click/swipe), independent of the lagging displayedIndex
  // above — virtualPages itself doesn't depend on which index is "current",
  // so this is safe to look up against the SAME array prev/current/next
  // were built from. Lets the outline below start turning blue the instant
  // the hop commits, rather than waiting out the slide-settle delay that
  // prev/current/next's role reassignment (deliberately) still waits for.
  const committedVirtualPage = virtualPages[clampPageIndex(committedIndex, pages.length, showBlankSlot)] ?? null;
  const committedSignature = slotSignature(committedVirtualPage);
  const isPrevCommitted = !!prev && slotSignature(prev) === committedSignature;
  const isCurrentCommitted = !!current && slotSignature(current) === committedSignature;
  const isNextCommitted = !!next && slotSignature(next) === committedSignature;

  // Tracks whichever page was actually rendered as `current` as of the last
  // completed render, for the reflow-forcing effect further down to compare
  // against — lets it recognize "this peek slot is simply the page that was
  // JUST active, demoting" as a distinct case from "a genuinely different
  // page is entering this slot". Deliberately NOT committedSignature: that
  // updates the instant a click commits, still several renders (the whole
  // slide) before `current` itself actually changes at settle — using it
  // here would start reflecting the new page far too early, defeating the
  // comparison below for the entire slide.
  const currentSignature = slotSignature(current);
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
  const slideDirection = committedIndex - displayedIndex;
  const lookaheadPage =
    Math.abs(slideDirection) === 1 ? virtualPages[activeIndex + slideDirection * 2] ?? null : null;
  const lookaheadSignature = slotSignature(lookaheadPage);

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
  const softLimitRows = isEditMode && viewportHeight > 0 ? pageSoftHeightRows(viewportHeight) : undefined;

  // Exiting edit mode should hide the border immediately rather than fading
  // it out — plainly giving outline-color a 0s duration outside of
  // .grid-page-slot--editing (see grid.scss) turned out not to reliably win
  // once other transitionable properties are ALSO changing on the exact
  // same render (min-height, --editing itself). Forcing it via the same
  // toggle-a-class/reflow/next-frame-remove trick already used elsewhere in
  // this file (see applyDisplayedIndexInstantly and the Chromium reflow fix
  // below) sidesteps that ambiguity entirely, at the cost of one extra ref.
  const activeSlotRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (isEditMode) return;
    const el = activeSlotRef.current;
    if (!el) return;
    el.classList.add('grid-page-slot--no-outline-transition');
    void el.offsetHeight; // force a reflow so the disable actually takes effect
    const raf = requestAnimationFrame(() => el.classList.remove('grid-page-slot--no-outline-transition'));
    return () => cancelAnimationFrame(raf);
  }, [isEditMode]);

  // Edit mode reserves room on each edge for a neighbor's sliver plus a gap
  // before it; view mode reserves nothing (the active page keeps the full
  // canvas width), so a neighbor sits fully off-screen at rest and only
  // passes through during the slide transition. It still needs its OWN gap
  // though — VIEW_MODE_PEEK_GAP_PX, not 0 — since a neighbor stays mounted
  // (see GridPage below) and .grid-page-viewport never clips; without a gap
  // wide enough to clear .dashboard-container's inline padding, sitting
  // flush against the active page's edge would let it poke into that
  // padding right at the screen edge instead of staying fully hidden.
  const reservePx = isEditMode ? PAGE_PEEK_SLIVER_PX + PAGE_GAP_PX : 0;
  const slotGapPx = isEditMode ? PAGE_GAP_PX : VIEW_MODE_PEEK_GAP_PX;

  // The local coordinate space the peek carousel lays out within: the real
  // canvas normally, but while simulating a device, the device's own width
  // plus room for a neighbor's sliver on each edge — NOT the real (wider)
  // canvas, so a peeking neighbor reads at the same size as the device
  // being simulated rather than the real screen.
  const localCanvasWidth = isSimulating
    ? GRID_PREVIEW_WIDTHS[activeBreakpoint] + 2 * reservePx
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
  const trackOffsetPx = restingTrackOffsetPx - (committedIndex - displayedIndex) * (pageWidth + slotGapPx);

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
      if (willDeletePage) goToIndex(pageIndex - 1);
    },
    [onRemoveWidget, effectiveBreakpoint, pages, goToIndex]
  );
  // --- Drag-to-edge: dragging a widget onto a peek neighbor's actual
  // hitbox (its rendered bounding box — see isPointInRect below, not a
  // column-count threshold) relocates it onto that page immediately and
  // the view follows, while the same mouse-down gesture keeps going so the
  // user can choose exactly where to drop it (see the relocation block
  // further down). Only wired on the active page — peek panes do share
  // isEditMode's true value (so an incoming page already looks edit-ready
  // mid-slide, not "normal" until it lands), but their wrapping
  // .grid-page-slot-content is pointer-events:none, so no mouse event ever
  // reaches their drag handles regardless of dragConfig.enabled.
  const armLeftRef = useRef<HTMLDivElement>(null);
  const armRightRef = useRef<HTMLDivElement>(null);
  const suppressNextLayoutChangeRef = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);

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
  const prevSignature = slotSignature(prev);
  const nextSignature = slotSignature(next);
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
    for (const [signature, el] of [
      [prevSignature, armLeftRef.current],
      [nextSignature, armRightRef.current],
    ] as const) {
      if (!el || signature === outgoingSignature || signature === outgoingLookaheadSignature) continue;
      el.style.display = 'none';
      void el.offsetHeight;
      el.style.display = '';
    }
  }, [prevSignature, nextSignature]);

  // Applies a new displayedIndex without animating — used both to settle a
  // slide (transform reset to its resting value at the same moment
  // prev/active/next reassign, which visually cancel out) and to cut
  // straight to a non-adjacent target (no slide to play at all).
  const applyDisplayedIndexInstantly = useCallback((index: number) => {
    const el = trackRef.current;
    el?.classList.add('grid-page-track--no-transition');
    setDisplayedIndex(index);
    requestAnimationFrame(() => el?.classList.remove('grid-page-track--no-transition'));
  }, []);

  // Drives the slide: an adjacent-step change to the committed index keeps
  // displayedIndex (and so prev/active/next) on the OLD page one extra
  // beat, while trackOffsetPx above already overshoots by one slot — once
  // that overshoot finishes animating, swap prev/active/next to the new
  // page and reset the transform in the same instant. A non-adjacent jump
  // (e.g. a distant dot click) has no adjacent overshoot to play, so it
  // just cuts straight there.
  useLayoutEffect(() => {
    if (slideTimeoutRef.current) {
      clearTimeout(slideTimeoutRef.current);
      slideTimeoutRef.current = null;
    }
    if (committedIndex === displayedIndex) return;
    if (Math.abs(committedIndex - displayedIndex) !== 1) {
      // Synchronizing displayed state to an external commit, paired with
      // the no-transition DOM toggle inside — not derivable during render.
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      applyDisplayedIndexInstantly(committedIndex);
      return;
    }
    slideTimeoutRef.current = setTimeout(() => {
      slideTimeoutRef.current = null;
      applyDisplayedIndexInstantly(committedIndex);
    }, PAGE_SLIDE_MS);
  }, [committedIndex, displayedIndex, applyDisplayedIndexInstantly]);

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

  useEffect(() => () => {
    if (slideTimeoutRef.current) clearTimeout(slideTimeoutRef.current);
  }, []);

  // A breakpoint switch is a different page set entirely, not a slide —
  // snap displayedIndex to match immediately, uncapped. Deliberately NOT
  // keyed on isEditMode too (despite it also changing reservePx/pageWidth):
  // toggling edit mode alone, on the SAME breakpoint, either leaves
  // committedIndex/displayedIndex equal (nothing to resync) or — exiting
  // from the blank "new page" slot — puts them exactly one step apart,
  // which the "drives the slide" effect above already animates correctly
  // on its own via showBlankSlot. Snapping here too would win the race
  // against that effect's own setTimeout (this one runs synchronously,
  // same commit) and cut the animation short into an instant jump.
  useLayoutEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    applyDisplayedIndexInstantly(activePageIndex[effectiveBreakpoint] ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveBreakpoint]);

  // Tracks a cross-page widget relocation while it's in flight (see
  // beginRelocation further down) — declared up here so the liveRef
  // confirmation effect right below can reference it.
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
  //   goToIndex/onMoveWidgetToPage only take effect on some later render,
  //   not synchronously inside beginRelocation. A second hop firing in that
  //   gap reads liveRef.current still holding the pre-hop snapshot,
  //   computing a goToIndex target from data that's already stale by the
  //   time it lands, which desyncs activePageIndex from the actual page
  //   list — and page.tsx's own clamp effect (which corrects
  //   activePageIndex against the real page count) and Grid's slide-settle
  //   effect (which reacts to activePageIndex) then fight over the result,
  //   which is what actually trips React's "Maximum update depth exceeded"
  //   guard, not a direct loop in this file. Blocking any new hop until the
  //   previous one is confirmed landed (current page id === its target)
  //   closes this regardless of how fast the mouse moves.
  // grabOffsetX/Y: the cursor's pixel offset from the widget's own
  // top-left, captured once from its real on-screen box the instant the
  // first hop fires (see the ghost element created in beginRelocation) —
  // preserved across every subsequent hop so the ghost keeps tracking the
  // cursor at the exact same spot within it a native drag would have.
  const relocationRef = useRef<{
    widgetId: string;
    w: number;
    h: number;
    targetPageId: string;
    awaitingExit: boolean;
    pendingConfirmation: boolean;
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
  // ref-callback pattern as beginRelocationRef below), rather than threaded
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
  // restingTrackOffsetPx/goToDelta), for the same reason: those handlers are
  // attached once and live for the component's lifetime, not re-attached on
  // every render just because a page changed.
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
    goToIndex,
    goToDelta,
    committedIndex,
    pageWidth,
    slotGapPx,
    restingTrackOffsetPx,
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
      goToIndex,
      goToDelta,
      committedIndex,
      pageWidth,
      slotGapPx,
      restingTrackOffsetPx,
    };
    // Confirms an in-flight hop once `current` actually catches up to the
    // page it targeted — see the big comment on relocationRef above.
    const state = relocationRef.current;
    if (state?.pendingConfirmation && current.kind === 'real' && current.page.id === state.targetPageId) {
      state.pendingConfirmation = false;
    }
  });

  // Once a widget has been handed off to a neighboring page mid-drag (see
  // beginRelocation below), react-grid-layout's own drag tracking on the
  // SOURCE page goes dead — its DOM node is gone, removed from that page's
  // layout. This tracks the live cursor ourselves from that point on,
  // translating it into grid units on whichever page is now active with
  // the same pixel<->grid math react-grid-layout uses internally, so the
  // widget keeps following the mouse and the user can still choose exactly
  // where to drop it.
  const pendingPointRef = useRef<{ x: number; y: number } | null>(null);
  const relocationRafRef = useRef(false);
  // Holds whichever move/up functions are currently registered on window —
  // captured once, at attach time, purely so the detach side can remove the
  // exact same references (see beginRelocation) without the two ends
  // needing to name each other directly.
  const attachedRelocationListenersRef = useRef<{ move: (e: Event) => void; up: () => void } | null>(null);
  // Always points at the latest beginRelocation (assigned in the layout
  // effect just below it) so the move-listener created inside beginRelocation
  // can trigger another hop without having to reference beginRelocation by
  // name from inside its own definition.
  const beginRelocationRef = useRef<
    (
      direction: 'left' | 'right',
      widgetId: string,
      w: number,
      h: number,
      point?: { x: number; y: number },
      sourceElement?: HTMLElement | null,
      nativeEvent?: Event
    ) => void
  >(() => {});

  // A relocated widget's own data (x/y in grid units) still has to update
  // for compaction/persistence to work, but rendering it at that quantized
  // cell position while dragging would visibly snap and desync from the
  // cursor mid-gesture — the exact "changed position" the widget shouldn't
  // do. Instead its real DOM node is hidden (see applyRelocatedPosition)
  // and this floating clone — captured once from its actual on-screen box
  // via getBoundingClientRect the instant the first hop fires, so it starts
  // out pixel-identical to what react-grid-layout's own native drag was
  // already showing — stands in for it, tracking the cursor 1:1 by the
  // grabOffsetX/Y captured at that same moment. Dropping just removes it
  // and reveals the real widget, already sitting at its final committed
  // position.
  const ghostElRef = useRef<HTMLDivElement | null>(null);

  const createGhost = useCallback((sourceElement: HTMLElement, point: { x: number; y: number }) => {
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

  const updateGhostPosition = useCallback((point: { x: number; y: number }) => {
    const ghost = ghostElRef.current;
    const state = relocationRef.current;
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
  const applyRelocatedPosition = useCallback((point: { x: number; y: number }, isDropping = false) => {
    const state = relocationRef.current;
    if (!state) return;
    updateGhostPosition(point);

    // `.grid-page-slot--active` doesn't actually swap onto the target page
    // until the hop's slide settles (state.pendingConfirmation clears — see
    // relocationRef's big comment), so until then this selector still
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

    const { effectiveBreakpoint, pages, onLayoutChange } = liveRef.current;
    const gridEl = document.querySelector<HTMLElement>('.grid-page-slot--active .grid');
    if (!gridEl) return;
    const widgetEl = gridEl.querySelector<HTMLElement>(`[data-widget-id="${state.widgetId}"]`);
    if (widgetEl) widgetEl.style.display = 'none';
    const rect = gridEl.getBoundingClientRect();
    const positionParams = {
      margin: GRID_ITEM_MARGIN,
      containerPadding: GRID_CONTAINER_PADDING,
      containerWidth: rect.width,
      cols: GRID_COLS[effectiveBreakpoint],
      rowHeight: GRID_ROW_HEIGHT,
      maxRows: Infinity,
    };
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

    const moved = moveElement(clonedLayout, item, x, y, true, false, verticalCompactor.type, positionParams.cols, false);
    const nextLayout = verticalCompactor.compact(moved, positionParams.cols);
    const resolvedItem = nextLayout.find((it) => it.i === state.widgetId) ?? item;

    const placeholderEl = ensurePlaceholder(gridEl);
    placeholderEl.style.display = ''; // undo the pendingConfirmation hide above, now that there's somewhere real to show it
    const pos = calcGridItemPosition(positionParams, resolvedItem.x, resolvedItem.y, state.w, liveH);
    placeholderEl.style.left = `${pos.left}px`;
    placeholderEl.style.top = `${pos.top}px`;
    placeholderEl.style.width = `${pos.width}px`;
    placeholderEl.style.height = `${pos.height}px`;

    for (const otherItem of nextLayout) {
      if (otherItem.i === state.widgetId) continue;
      const otherEl = gridEl.querySelector<HTMLElement>(`[data-widget-id="${otherItem.i}"]`);
      if (!otherEl) continue;
      const otherPos = calcGridItemPosition(positionParams, otherItem.x, otherItem.y, otherItem.w, otherItem.h);
      otherEl.style.transform = `translate(${otherPos.left}px, ${otherPos.top}px)`;
      otherEl.style.width = `${otherPos.width}px`;
      otherEl.style.height = `${otherPos.height}px`;
    }

    if (!isDropping) return;
    onLayoutChange(effectiveBreakpoint, state.targetPageId, nextLayout);
  }, [updateGhostPosition, ensurePlaceholder]);

  const detachRelocationListeners = useCallback(() => {
    const listeners = attachedRelocationListenersRef.current;
    if (listeners) {
      window.removeEventListener('mousemove', listeners.move);
      window.removeEventListener('touchmove', listeners.move);
      window.removeEventListener('mouseup', listeners.up);
      window.removeEventListener('touchend', listeners.up);
      attachedRelocationListenersRef.current = null;
    }
    // Flush whatever position the cursor was last known to be at before
    // tearing the relocation state down. isDropping=true is what makes this
    // call actually commit to React state — every earlier frame this drag
    // only computed a local preview (see applyRelocatedPosition), so this
    // is also the FIRST write for this gesture, landing the dragged widget
    // and anything it pushed out of the way in one atomic step.
    const finalPoint = pendingPointRef.current;
    if (finalPoint) applyRelocatedPosition(finalPoint, true);
    if (relocationRef.current) revealRelocatedWidget(relocationRef.current.widgetId);
    destroyGhost();
    destroyPlaceholder();
    relocationRef.current = null;
    pendingPointRef.current = null;
    armLeftRef.current?.classList.remove('grid-page-slot--armed');
    armRightRef.current?.classList.remove('grid-page-slot--armed');
    clearHopHold();
  }, [applyRelocatedPosition, revealRelocatedWidget, destroyGhost, destroyPlaceholder, clearHopHold]);

  // Coalesced to at most once per animation frame — a raw mousemove/
  // touchmove can fire far faster than that, and each call already writes
  // through to app state (debounced further downstream before it ever
  // reaches Firestore — see useGridState's write debounce).
  const scheduleRelocatedPositionUpdate = useCallback(
    (point: { x: number; y: number }) => {
      pendingPointRef.current = point;
      if (relocationRafRef.current) return;
      relocationRafRef.current = true;
      requestAnimationFrame(() => {
        relocationRafRef.current = false;
        if (pendingPointRef.current) applyRelocatedPosition(pendingPointRef.current);
      });
    },
    [applyRelocatedPosition]
  );

  // Re-checks the hitbox test on every move (not just at entry) so a drag
  // that keeps going can hop across more than one page boundary in a row.
  const handleRelocationPointerMove = useCallback(
    (event: Event) => {
      if (!relocationRef.current) return;
      const point = getEventPoint(event);
      if (!point) return;
      scheduleRelocatedPositionUpdate(point);
      const { prev, next } = liveRef.current;
      const overLeft = !!prev && isPointInRect(point, armLeftRef.current?.getBoundingClientRect());
      const overRight = !!next && isPointInRect(point, armRightRef.current?.getBoundingClientRect());
      armLeftRef.current?.classList.toggle('grid-page-slot--armed', overLeft);
      armRightRef.current?.classList.toggle('grid-page-slot--armed', overRight);
      const state = relocationRef.current;
      if (state.pendingConfirmation) return; // previous hop hasn't landed in a render yet — see relocationRef's comment
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
      hopHoldFireRef.current = () => beginRelocationRef.current(direction, state.widgetId, state.w, state.h);
      armHopHold(direction);
    },
    [scheduleRelocatedPositionUpdate, armHopHold, clearHopHold]
  );

  // Hands a widget off to the peek neighbor on `direction`, replicating
  // handleActiveDragStop's old drop-time logic (page creation, the
  // source-page-collapses-so-shift-the-target-index case) but firing the
  // instant the cursor enters that neighbor's actual hitbox instead of
  // waiting for the drop — and, unlike a drop, leaving the gesture live so
  // scheduleRelocatedPositionUpdate can keep steering the widget afterward.
  const beginRelocation = useCallback(
    (
      direction: 'left' | 'right',
      widgetId: string,
      w: number,
      h: number,
      point?: { x: number; y: number },
      sourceElement?: HTMLElement | null,
      nativeEvent?: Event
    ) => {
      const { current, prev, next, pages, effectiveBreakpoint, activeIndex, onCreatePage, onMoveWidgetToPage, goToIndex } =
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

      // The ghost (and its grab offset) is created once, from the widget's
      // real on-screen box at the moment of the FIRST hop — every hop after
      // that just keeps steering the same ghost with the same offset, since
      // there's no fresh "real" box to recapture from once it's hidden.
      const isFreshHop = !ghostElRef.current && !!sourceElement && !!point;
      const grabOffset = isFreshHop
        ? createGhost(sourceElement, point)
        : { grabOffsetX: relocationRef.current?.grabOffsetX ?? 0, grabOffsetY: relocationRef.current?.grabOffsetY ?? 0 };

      // Only relevant on that same first hop — react-grid-layout's own
      // native drag is still genuinely live on the source page at this
      // point (see endNativeDrag above), and is about to be yanked out from
      // under it by onMoveWidgetToPage below.
      if (isFreshHop && nativeEvent) endNativeDrag(sourceElement, nativeEvent);

      relocationRef.current = {
        widgetId,
        w,
        h,
        targetPageId,
        awaitingExit: true,
        pendingConfirmation: true,
        ...grabOffset,
      };
      suppressNextLayoutChangeRef.current = true;
      onMoveWidgetToPage(widgetId, effectiveBreakpoint, current.page.id, targetPageId);
      goToIndex(direction === 'left' ? activeIndex - 1 : sourceWillBeDeleted ? activeIndex : activeIndex + 1);

      if (!attachedRelocationListenersRef.current) {
        const move = handleRelocationPointerMove;
        const up = detachRelocationListeners;
        attachedRelocationListenersRef.current = { move, up };
        window.addEventListener('mousemove', move);
        window.addEventListener('touchmove', move, { passive: true });
        window.addEventListener('mouseup', up);
        window.addEventListener('touchend', up);
      }
    },
    [handleRelocationPointerMove, detachRelocationListeners, createGhost]
  );
  useLayoutEffect(() => {
    beginRelocationRef.current = beginRelocation;
  });

  const handleActiveDrag = useCallback(
    (
      _layout: Layout,
      _oldItem: LayoutItem | null,
      newItem: LayoutItem | null,
      _placeholder: LayoutItem | null,
      event: Event,
      element: HTMLElement | null
    ) => {
      if (!newItem || relocationRef.current) return;
      const point = getEventPoint(event);
      if (!point) return;
      const overLeft = !!prev && isPointInRect(point, armLeftRef.current?.getBoundingClientRect());
      const overRight = !!next && isPointInRect(point, armRightRef.current?.getBoundingClientRect());
      armLeftRef.current?.classList.toggle('grid-page-slot--armed', overLeft);
      armRightRef.current?.classList.toggle('grid-page-slot--armed', overRight);
      if (!overLeft && !overRight) {
        clearHopHold();
        return;
      }
      const direction = overLeft ? 'left' : 'right';
      // Reassigned every frame spent hovering the hitbox, so whenever
      // armHopHold's timer actually fires (PAGE_HOP_HOLD_MS later) it hands
      // off the CURRENT cursor position/element/event to beginRelocation,
      // not a stale one captured back when the hold first started.
      hopHoldFireRef.current = () => beginRelocation(direction, newItem.i, newItem.w, newItem.h, point, element, event);
      armHopHold(direction);
    },
    [prev, next, beginRelocation, armHopHold, clearHopHold]
  );

  const handleActiveDragStop = useCallback(() => {
    // A relocation in progress means this gesture was already taken over —
    // the widget's DOM node on this page is gone, so whatever react-grid-
    // layout thinks it's dropping here is stale. The global mouseup/
    // touchend listener (detachRelocationListeners) is the real finalizer.
    if (relocationRef.current) return;
    armLeftRef.current?.classList.remove('grid-page-slot--armed');
    armRightRef.current?.classList.remove('grid-page-slot--armed');
    clearHopHold();
  }, [clearHopHold]);

  // Safety net: release the gesture-scoped window listeners if this
  // component unmounts mid-drag (e.g. navigating away).
  useEffect(() => detachRelocationListeners, [detachRelocationListeners]);

  const handleWidgetHeightsChange = useCallback(
    (pageId: string, patches: Array<{ id: string; h: number }>) =>
      onWidgetHeightsChange(effectiveBreakpoint, pageId, patches),
    [onWidgetHeightsChange, effectiveBreakpoint]
  );

  const handleActiveLayoutChange = useCallback(
    (pageId: string, layout: Layout) => {
      // RGL fires the source page's own onLayoutChange around the same drop
      // as onDragStop. If the drop just got rerouted to a neighbor, that
      // commit would otherwise persist the widget at its clamped edge
      // position on a page it's about to be removed from — skip it once.
      if (suppressNextLayoutChangeRef.current) {
        suppressNextLayoutChangeRef.current = false;
        return;
      }
      onLayoutChange(effectiveBreakpoint, pageId, layout);
    },
    [effectiveBreakpoint, onLayoutChange]
  );
  const handleViewLayoutChange = useCallback(
    (pageId: string, layout: Layout) => onLayoutChange(effectiveBreakpoint, pageId, layout),
    [effectiveBreakpoint, onLayoutChange]
  );

  // --- Swipe / wheel / keyboard paging ---
  // Touch paging tracks the finger 1:1 (like iOS's springboard) rather than
  // committing on a single detected swipe gesture: the track's transform is
  // driven imperatively off touchmove deltas (bypassing React entirely, same
  // pattern as the cross-page drag ghost above) so it can follow the finger
  // at 60fps without a render in between, then only on release does it
  // either hand off to goToDelta (a fast flick, or a slow drag that crossed
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
    // not via applyDisplayedIndexInstantly's own no-transition toggle, which
    // removes itself again one frame later (via rAF) and would start easing
    // every subsequent touchmove frame instead of snapping straight to the
    // finger.
    const beginDrag = () => {
      if (slideTimeoutRef.current) {
        clearTimeout(slideTimeoutRef.current);
        slideTimeoutRef.current = null;
      }
      setDisplayedIndex(liveRef.current.committedIndex);
      trackRef.current?.classList.add('grid-page-track--no-transition');
    };

    const endDrag = () => {
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
      const cleanup = () => {
        track.style.transitionDuration = '';
        track.removeEventListener('transitionend', cleanup);
      };
      track.addEventListener('transitionend', cleanup);
      setTimeout(cleanup, duration + 50); // safety net if transitionend never fires (e.g. interrupted)
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
      // relocationRef: a cross-page WIDGET drag is already steering the
      // view. areGesturesLocked: some widget's own internal gesture (today,
      // dragging a task/subtask row — see gestureLock.ts) has claimed this
      // touch instead; without this, the drag's own touchmove deltas were
      // easily big enough to also trip this handler's lock-detection below,
      // paging the whole track out from under the row being dragged.
      if (!touchStart || !touch || relocationRef.current || areGesturesLocked()) return;
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;
      if (touchLocked === null && Math.abs(dx) + Math.abs(dy) > 10) {
        touchLocked = Math.abs(dx) > Math.abs(dy) * SWIPE_DIRECTION_LOCK_RATIO;
        if (touchLocked) beginDrag();
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
        endDrag();
        return;
      }
      const duration = Date.now() - start.t;
      const { next, prev, pageWidth, goToDelta } = liveRef.current;
      const hasTarget = rawDx < 0 ? !!next : !!prev;
      const shouldCommit =
        hasTarget &&
        ((Math.abs(rawDx) >= SWIPE_DISTANCE_PX && duration <= SWIPE_MAX_DURATION_MS) ||
          Math.abs(rawDx) >= pageWidth * SWIPE_COMMIT_FRACTION);

      if (shouldCommit && tryClaimPageChange(PAGE_CHANGE_COOLDOWN_MS)) {
        trackRef.current?.classList.remove('grid-page-track--no-transition');
        goToDelta(rawDx < 0 ? 1 : -1);
      } else {
        snapBack(rawDx);
      }
      endDrag();
    };

    const handleTouchCancel = () => {
      if (touchLocked) snapBack(rawDx);
      endDrag();
    };

    let wheelAccumulated = 0;

    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return; // predominantly vertical — let it scroll/zoom normally
      event.preventDefault();

      wheelAccumulated += event.deltaX;
      if (Math.abs(wheelAccumulated) >= WHEEL_SWIPE_THRESHOLD) {
        const direction = wheelAccumulated > 0 ? 1 : -1;
        wheelAccumulated = 0;
        if (tryClaimPageChange(PAGE_CHANGE_COOLDOWN_MS)) liveRef.current.goToDelta(direction);
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
    // down and re-attach these listeners mid-gesture.
  }, [containerRef]);

  // Works in both edit and view mode — goToDelta already no-ops via
  // clampPageIndex when there's nowhere to go, so no extra guard is needed.
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
      if (!tryClaimPageChange(DESKTOP_PAGE_CHANGE_COOLDOWN_MS)) return;
      goToDelta(event.key === 'ArrowLeft' ? -1 : 1);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [goToDelta]);

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
      className={`grid-page-slot grid-page-slot--peek grid-page-slot--incoming${lookaheadVisible ? ' grid-page-slot--incoming-visible' : ''}${isEditMode ? ' grid-page-slot--editing' : ''}`}
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
            isEditMode={isEditMode}
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
        <div className="grid-page-viewport">
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
                className={`grid-page-slot grid-page-slot--peek${isEditMode ? ' grid-page-slot--editing' : ''}${isPrevCommitted ? ' grid-page-slot--committed' : ''}`}
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
                      isEditMode={isEditMode}
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
              className={`grid-page-slot grid-page-slot--active${isEditMode ? ' grid-page-slot--editing' : ''}${isCurrentCommitted ? ' grid-page-slot--committed' : ''}${isSimulating ? ' grid-page-slot--simulating' : ''}`}
              style={{ width: pageWidth }}
            >
              {/* Same .grid-page-slot-content depth as the peek/lookahead
                  slots (without --inert, so widgets stay clickable) — keeps
                  <GridPage> one level deep under every role so its key
                  actually gets matched across a peek<->active transition
                  instead of the depth mismatch forcing a remount. */}
              <div className="grid-page-slot-content">
                {current.kind === 'real' ? (
                  <GridPage
                    // Page identity alone (see lookahead's GridPage above) —
                    // lets this instance survive a role change (e.g. demoting
                    // to a peek neighbor) instead of remounting.
                    key={`${effectiveBreakpoint}:${current.page.id}`}
                    page={current.page}
                    effectiveBreakpoint={effectiveBreakpoint}
                    isEditMode={isEditMode}
                    isSimulating={isSimulating}
                    gridWidth={pageWidth}
                    softLimitRows={softLimitRows}
                    onLayoutChange={isEditMode ? handleActiveLayoutChange : handleViewLayoutChange}
                    onUpdateWidget={handleUpdateWidget}
                    onRemoveWidget={handleRemove}
                    onWidgetHeightsChange={handleWidgetHeightsChange}
                    onDrag={isEditMode ? handleActiveDrag : undefined}
                    onDragStop={isEditMode ? handleActiveDragStop : undefined}
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
                  // real via dragging a widget onto it (above) or clicking
                  // "Add Widget" while sitting on it (see page.tsx), never by
                  // clicking this pane itself.
                  <BlankPagePane variant="current" />
                )}
              </div>
            </div>

            {next && (
              <div
                // See the prev slot's comment above for why this is keyed
                // by page identity alone.
                key={`${effectiveBreakpoint}:${next.kind === 'real' ? next.page.id : 'blank'}`}
                className={`grid-page-slot grid-page-slot--peek${isEditMode ? ' grid-page-slot--editing' : ''}${isNextCommitted ? ' grid-page-slot--committed' : ''}`}
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
                      isEditMode={isEditMode}
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
    </div>
  );
}
