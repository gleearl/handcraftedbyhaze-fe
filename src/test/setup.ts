import "@testing-library/jest-dom/vitest";

/* jsdom renders <dialog> as an element but implements none of its modal
   behaviour, so showModal() is simply missing. The add-on picker opens itself
   with it, which makes the component unmountable in a test for want of two
   methods. Enough of them to open, close, and fire the close event the picker
   listens for — the real modality (backdrop, focus trap, inert page) is the
   browser's job and isn't what these tests are about. */
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };

  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement, value?: string) {
    this.open = false;
    if (value !== undefined) this.returnValue = value;
    this.dispatchEvent(new Event("close"));
  };
}
