import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import Dialog from "./Dialog.jsx";

function Harness({ onClose }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
        title="Remove facility?"
      >
        <p>This deletes all saved inputs for this facility.</p>
        <button type="button">Confirm</button>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("renders its content only while open, and labels itself by its title", () => {
    render(<Harness />);
    expect(screen.getByRole("heading", { name: "Remove facility?" })).toBeInTheDocument();
    expect(screen.getByText(/deletes all saved inputs/i)).toBeInTheDocument();
  });

  it("calls onClose when the close button is activated", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Remove facility?" })).not.toBeInTheDocument();
  });

  it("calls onClose on Escape", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on a click whose target is the dialog element itself (backdrop), not its content", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const dialogEl = document.querySelector("dialog");
    dialogEl.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when a click's target is inside the dialog's content", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByText(/deletes all saved inputs/i));
    expect(onClose).not.toHaveBeenCalled();
  });

  // Regression test: Playwright testing against real Chromium showed that
  // showModal() alone does NOT reliably keep Tab cycling inside the dialog --
  // Tab from the last focusable element escaped to <body>. Dialog.jsx now
  // wraps Tab/Shift+Tab manually; this confirms that wrap in isolation.
  it("wraps Tab from the last focusable element back to the first", async () => {
    render(<Harness />);
    const confirmButton = screen.getByRole("button", { name: "Confirm" });
    confirmButton.focus();
    expect(confirmButton).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("wraps Shift+Tab from the first focusable element back to the last", async () => {
    render(<Harness />);
    const closeButton = screen.getByRole("button", { name: "Close" });
    closeButton.focus();
    expect(closeButton).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
  });
});
