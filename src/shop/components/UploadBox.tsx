import { useEffect, useRef, useState } from "react";
import { CONFIG } from "../../config";
import { validateProofFile } from "../../lib/validate";
import { ErrorText } from "./ErrorText";

interface Props {
  file: File | null;
  onFile: (file: File | null) => void;
  error: string | null;
  onError: (message: string | null) => void;
}

export function UploadBox({ file, onFile, error, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /* One object URL at a time, revoked when it's replaced and when the step
     unmounts — otherwise every re-pick leaks the last blob for the life of
     the page. */
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    onError(null);

    if (!picked) { onFile(null); return; }

    // Told immediately, while the file picker is still in mind — not at submit.
    const problem = validateProofFile(picked);
    if (problem) {
      onFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onError(problem);
      return;
    }

    onFile(picked);
  }

  const hasFile = Boolean(file && previewUrl);

  return (
    <div className="mb-5">
      <span className="mb-2 block text-sm font-semibold" id="proofLabel">Proof of payment</span>

      <label
        className={`relative block cursor-pointer rounded-card border-[1.5px] bg-surface
                    focus-within:outline-2 focus-within:outline-focus-ring focus-within:outline-offset-1
                    ${hasFile
                      ? "border-solid border-brand p-3 text-left"
                      : "border-dashed px-4 py-6 text-center"}
                    ${error ? "border-danger" : hasFile ? "" : "border-field"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          aria-describedby="proofHint"
          aria-labelledby="proofLabel"
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />

        {hasFile ? (
          <span className="flex items-center gap-3">
            <img
              src={previewUrl!}
              alt="Your uploaded proof of payment"
              className="size-16 flex-none rounded-[10px] bg-surface-brand-soft object-cover"
            />
            <span className="min-w-0">
              <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold">
                {file!.name}
              </span>
              <span className="block text-[.8125rem] text-fg-muted">
                {(file!.size / 1024 / 1024).toFixed(1)} MB · tap to change
              </span>
            </span>
          </span>
        ) : (
          <span className="block">
            <span className="mb-1.5 block text-2xl" aria-hidden="true">🧾</span>
            <span className="block text-[.9375rem] font-semibold">Upload your GCash screenshot</span>
            <span className="block text-[.8125rem] text-fg-muted">
              JPG or PNG · up to {CONFIG.maxProofMB}&nbsp;MB
            </span>
          </span>
        )}
      </label>

      <p id="proofHint" className="mt-1.5 mb-0 text-[.8125rem] text-fg-muted">
        Make sure the amount and reference number are readable.
      </p>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
