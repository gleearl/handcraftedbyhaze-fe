import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { useReorder } from "./useReorder";

/* jsdom lays nothing out, so the rows are given the boxes they'd have on a
   screen: three 100px-tall rows stacked from the top. */
const boxAt = (i: number) => () =>
  ({ top: i * 100, bottom: i * 100 + 100 }) as DOMRect;

function List({ onCommit }: { onCommit: (names: string[]) => void }) {
  const [rows, setRows] = useState(["Bunny", "Bear", "Cat"]);
  const { rowRef, drag } = useReorder(rows, setRows, (next) => onCommit(next));

  return (
    <ul>
      {rows.map((name, i) => (
        <li
          key={name}
          ref={(el) => {
            rowRef(i)(el);
            if (el) el.getBoundingClientRect = boxAt(i);
          }}
        >
          <button type="button" aria-label={`Move ${name}`} {...drag(i).handle}>⠿</button>
          {name}
        </li>
      ))}
    </ul>
  );
}

const shown = () =>
  screen.getAllByRole("button").map((b) => b.getAttribute("aria-label")!.slice(5));

describe("useReorder", () => {
  it("saves once when a drag ends, however many rows it crossed", () => {
    const onCommit = vi.fn();
    render(<List onCommit={onCommit} />);

    const handle = screen.getByLabelText("Move Bunny");
    handle.setPointerCapture = vi.fn();
    handle.releasePointerCapture = vi.fn();

    fireEvent.pointerDown(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 150 }); // into row 2
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 250 }); // and row 3
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.pointerUp(handle, { pointerId: 1 });

    expect(shown()).toEqual(["Bear", "Cat", "Bunny"]);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(["Bear", "Cat", "Bunny"]);
  });

  it("saves nothing when a drag puts the row back where it started", () => {
    const onCommit = vi.fn();
    render(<List onCommit={onCommit} />);

    const handle = screen.getByLabelText("Move Bunny");
    handle.setPointerCapture = vi.fn();
    handle.releasePointerCapture = vi.fn();

    fireEvent.pointerDown(handle, { pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });

    expect(onCommit).not.toHaveBeenCalled();
  });
});
