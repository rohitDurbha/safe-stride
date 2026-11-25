import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  /** Always visible, including when the sheet is collapsed to a peek. */
  header: React.ReactNode;
  children?: React.ReactNode;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** Map buttons that ride on top of the sheet on phones. */
  fab?: React.ReactNode;
  className?: string;
}

const DRAG_THRESHOLD = 56;

/**
 * A draggable sheet on phones and a floating side card from the md breakpoint
 * up. On phones, drag the handle (or tap it) to switch between the full sheet
 * and a peek that shows only the header.
 */
const BottomSheet: React.FC<BottomSheetProps> = ({ header, children, collapsed, onCollapsedChange, fab, className }) => {
  const [dragY, setDragY] = useState<number | null>(null);
  const startRef = useRef<{ y: number; moved: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    startRef.current = { y: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const start = startRef.current;
    if (!start) return;
    const dy = e.clientY - start.y;
    if (Math.abs(dy) > 4) start.moved = true;
    // Resist dragging past the open position.
    setDragY(collapsed ? Math.min(0, dy) : Math.max(-24, dy));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const start = startRef.current;
    startRef.current = null;
    setDragY(null);
    if (!start) return;
    const dy = e.clientY - start.y;
    if (!start.moved) onCollapsedChange(!collapsed);
    else if (!collapsed && dy > DRAG_THRESHOLD) onCollapsedChange(true);
    else if (collapsed && dy < -DRAG_THRESHOLD) onCollapsedChange(false);
  };

  const dragging = dragY !== null;

  return (
    <section
      data-collapsed={collapsed}
      className={cn(
        'pointer-events-auto fixed inset-x-0 bottom-0 z-[1100] animate-sheet-up [--sheet-peek:calc(100px+env(safe-area-inset-bottom))] md:static md:animate-blur-in',
        className,
      )}
      style={dragging ? { transform: `translateY(${collapsed ? `calc(100% - var(--sheet-peek) + ${dragY}px)` : `${dragY}px`})` } : undefined}
    >
      <div
        className={cn(
          'surface-solid relative mx-auto flex max-h-[56dvh] w-full flex-col rounded-t-[28px] border-b-0 pb-safe md:max-h-full md:min-h-0 md:rounded-[28px] md:border-b',
          !dragging && 'transition-transform duration-500 ease-spring',
          collapsed && !dragging && 'max-md:translate-y-[calc(100%-var(--sheet-peek))]',
        )}
      >
        {fab && <div className="absolute bottom-full right-3 mb-3 flex flex-col gap-2 md:hidden">{fab}</div>}
        <button
          type="button"
          aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
          aria-expanded={!collapsed}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { startRef.current = null; setDragY(null); }}
          className="flex h-6 w-full shrink-0 touch-none cursor-grab items-center justify-center active:cursor-grabbing md:hidden"
        >
          <span className="h-1.5 w-10 rounded-full bg-muted-foreground/40" />
        </button>
        <div className="shrink-0 px-5 pb-3 md:pt-5">{header}</div>
        {children && (
          <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 transition-opacity duration-300', collapsed && 'max-md:opacity-0')}>
            {children}
          </div>
        )}
      </div>
    </section>
  );
};

export default BottomSheet;
