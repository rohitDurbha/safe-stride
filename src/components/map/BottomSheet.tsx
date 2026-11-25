import React, { useRef } from 'react';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  /** Always visible, including when the sheet is collapsed to a peek. */
  header: React.ReactNode;
  children?: React.ReactNode;
  /** Changes whenever the content is swapped, so only the content fades, not the whole sheet. */
  contentKey: string;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** Map buttons that ride on top of the sheet on phones. */
  fab?: React.ReactNode;
  className?: string;
}

const DISTANCE_THRESHOLD = 56; // px
const FLING_VELOCITY = 0.45; // px per ms

/**
 * A draggable sheet on phones and a floating side card from the md breakpoint
 * up. Dragging writes the transform straight to the element on each animation
 * frame, so React does not re-render the sheet while a finger is moving.
 */
const BottomSheet: React.FC<BottomSheetProps> = ({
  header, children, contentKey, collapsed, onCollapsedChange, fab, className,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; lastY: number; lastT: number; velocity: number; moved: boolean; frame: number; base: number } | null>(null);

  const setOffset = (y: number | null) => {
    const panel = panelRef.current;
    if (!panel) return;
    if (y === null) {
      panel.style.removeProperty('transform');
      panel.style.removeProperty('transition');
    } else {
      panel.style.transition = 'none';
      panel.style.transform = `translate3d(0, ${y}px, 0)`;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const panel = panelRef.current;
    if (!panel) return;
    // Where the panel sits right now, read from its transform: 0 when open, more when collapsed.
    const current = getComputedStyle(panel).transform;
    const base = current && current !== 'none' ? new DOMMatrixReadOnly(current).m42 : 0;
    drag.current = { startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, velocity: 0, moved: false, frame: 0, base };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 4) d.moved = true;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.velocity = 0.8 * ((e.clientY - d.lastY) / dt) + 0.2 * d.velocity;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    if (!d.moved) return;
    cancelAnimationFrame(d.frame);
    // Rubber band when pulling above the open position.
    const raw = d.base + dy;
    const y = raw < 0 ? raw / 4 : raw;
    d.frame = requestAnimationFrame(() => setOffset(y));
  };

  const finish = (e: React.PointerEvent | null) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    cancelAnimationFrame(d.frame);
    setOffset(null);
    if (!e) return;
    const dy = e.clientY - d.startY;
    if (!d.moved) {
      onCollapsedChange(!collapsed);
    } else if (d.velocity > FLING_VELOCITY || (!collapsed && dy > DISTANCE_THRESHOLD)) {
      onCollapsedChange(true);
    } else if (d.velocity < -FLING_VELOCITY || (collapsed && dy < -DISTANCE_THRESHOLD)) {
      onCollapsedChange(false);
    }
  };

  return (
    <section className={cn('pointer-events-auto fixed inset-x-0 bottom-0 z-[1100] md:static', className)}>
      <div
        ref={panelRef}
        className={cn(
          'sheet-panel surface-solid relative mx-auto flex max-h-[56dvh] w-full flex-col rounded-t-[28px] border-b-0 pb-safe',
          'md:max-h-full md:min-h-0 md:rounded-[28px] md:border-b',
          collapsed && 'sheet-collapsed',
        )}
      >
        {fab && <div className="absolute bottom-full right-3 mb-3 flex flex-col gap-2 md:hidden">{fab}</div>}
        <button
          type="button"
          aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
          aria-expanded={!collapsed}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finish}
          onPointerCancel={() => finish(null)}
          className="flex h-7 w-full shrink-0 touch-none cursor-grab items-center justify-center active:cursor-grabbing md:hidden"
        >
          <span className="h-1.5 w-10 rounded-full bg-muted-foreground/40" />
        </button>
        <div key={`h-${contentKey}`} className="fade-swap shrink-0 px-5 pb-3 md:pt-5">{header}</div>
        {children && (
          <div
            key={`b-${contentKey}`}
            className="sheet-body fade-swap min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5"
          >
            {children}
          </div>
        )}
      </div>
    </section>
  );
};

export default BottomSheet;
