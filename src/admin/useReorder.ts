import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/* Dragging a list into a new order, shared by the extras on the product form
   and the pieces on the products list.

   Pointer events rather than HTML5 drag-and-drop: that API never fires on
   touch, and this admin is used on a phone. One set of handlers covers mouse,
   pen and finger, and `touch-action: none` on the handle — see DRAG_HANDLE —
   is what stops the page scrolling out from under a drag.

   The arrow keys move a row too. A handle that only answers to dragging is one
   a keyboard can't reach at all, and it costs four lines not to have that. */

/** Move one row to another index, leaving what each row *is* untouched. */
export function moveRow<T>(rows: T[], from: number, to: number): T[] {
  const next = [...rows];
  const [row] = next.splice(from, 1);
  if (row !== undefined) next.splice(to, 0, row);
  return next;
}

/**
 * What the row is told: whether it's the one being dragged, and the props its
 * grip spreads. They're kept apart because `active` is for styling the row and
 * would land on the DOM as an unknown attribute if it travelled with the rest.
 */
export interface DragProps {
  active: boolean;
  handle: {
    /* Marks the grip so a keyboard move can put focus back on it, without the
       hook having to guess which of a row's controls the grip was. */
    "data-drag-handle": true;
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLElement>) => void;
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  };
}

/**
 * `onReorder` is handed the whole list in its new order, not a pair of
 * indices: a caller that has to persist the arrangement needs the order
 * itself, and one that doesn't can ignore the difference.
 *
 * `onCommit` is where saving belongs. `onReorder` fires on every row a drag
 * crosses — that is what makes the list rearrange under the finger — so a
 * caller that saved there would send a request per row passed. This fires once,
 * when the drag ends somewhere new, and once per keyboard move, which has no
 * drop to wait for.
 */
export function useReorder<T>(
  rows: T[],
  onReorder: (rows: T[]) => void,
  onCommit?: (rows: T[]) => void,
): {
  rowRef: (i: number) => (el: HTMLElement | null) => void;
  drag: (i: number) => DragProps;
} {
  const [dragging, setDragging] = useState<number | null>(null);
  const refs = useRef<(HTMLElement | null)[]>([]);
  // Where the row started, so a drag that wanders and comes home saves nothing.
  const from = useRef<number | null>(null);

  /* Hit-test the rows themselves rather than assume a row height: one with a
     photo on it is taller than one without, and a guessed height drops the row
     in the wrong place exactly when the list is worth reordering. */
  const rowUnder = (y: number): number =>
    refs.current.findIndex((el) => {
      if (!el) return false;
      const box = el.getBoundingClientRect();
      return y >= box.top && y <= box.bottom;
    });

  const rowRef = (i: number) => (el: HTMLElement | null) => { refs.current[i] = el; };

  const drag = (i: number): DragProps => ({
    active: dragging === i,
    handle: {
      "data-drag-handle": true,
      onPointerDown: (e) => {
        e.preventDefault();
        // Focus by hand: preventDefault above is what stops the browser
        // treating the press as the start of a text selection, and it costs
        // the grip the focus it would otherwise have taken.
        e.currentTarget.focus();
        e.currentTarget.setPointerCapture(e.pointerId);
        from.current = i;
        setDragging(i);
      },
      onPointerMove: (e) => {
        if (dragging === null) return;
        const over = rowUnder(e.clientY);
        // Reordered as the pointer crosses into a row, so what you see while
        // dragging is already the order you'll get when you let go.
        if (over >= 0 && over !== dragging) {
          onReorder(moveRow(rows, dragging, over));
          setDragging(over);
        }
      },
      onPointerUp: (e) => {
        if (dragging === null) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        // `rows` here is already the arrangement the drag left behind: every
        // crossing re-rendered, and these handlers came with that render.
        if (dragging !== from.current) onCommit?.(rows);
        from.current = null;
        setDragging(null);
      },
      onKeyDown: (e) => {
        const to = e.key === "ArrowUp" ? i - 1 : e.key === "ArrowDown" ? i + 1 : -1;
        if (to < 0 || to >= rows.length) return;
        e.preventDefault();
        const next = moveRow(rows, i, to);
        onReorder(next);
        onCommit?.(next);
        // Keep the handle under the finger that's still pressing the key.
        requestAnimationFrame(
          () => refs.current[to]?.querySelector<HTMLElement>("[data-drag-handle]")?.focus(),
        );
      },
    },
  });

  return { rowRef, drag };
}

/** The grip itself, wherever it's drawn. */
export const DRAG_HANDLE =
  `grid size-9 flex-none cursor-grab touch-none place-items-center rounded-xs
   text-fg-muted select-none active:cursor-grabbing hover:bg-surface
   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring`;

/** What the handle says it does, for the screen reader that can't see it. */
export const dragLabel = (name: string, index: number, count: number): string =>
  `Move ${name}, ${index + 1} of ${count}. Drag, or use the arrow keys.`;
