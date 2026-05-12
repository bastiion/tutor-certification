import { useEffect, useId, useState, type FormEvent, type ReactElement } from "react";

export interface RevokeDialogProps {
  open: boolean;
  participantName: string;
  certId: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  submitting: boolean;
}

export function RevokeDialog({
  open,
  participantName,
  certId,
  onClose,
  onConfirm,
  submitting,
}: RevokeDialogProps): ReactElement | null {
  const reasonId = useId();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open, certId]);

  if (!open) return null;

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    const t = reason.trim();
    if (t === "") return;
    onConfirm(t);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
      data-cy="revoke-dialog-backdrop"
    >
      <div
        className="max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${reasonId}-title`}
        onClick={(ev) => {
          ev.stopPropagation();
        }}
        data-cy="revoke-dialog"
      >
        <h2 id={`${reasonId}-title`} className="text-lg font-semibold text-stone-900">
          Bescheinigung widerrufen
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          Teilnehmer: <strong>{participantName}</strong>
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-stone-800" htmlFor={`${reasonId}-reason`}>
            Grund (frei)
          </label>
          <textarea
            id={`${reasonId}-reason`}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
            }}
            rows={4}
            placeholder={'z. B. „Doppelt eingeschrieben“ oder „Kursteilnahme nicht nachgewiesen“'}
            disabled={submitting}
            className="w-full rounded-lg border border-stone-300 p-2 text-sm shadow-sm"
            data-cy="revoke-reason"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800"
              data-cy="revoke-cancel"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={submitting || reason.trim() === ""}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              data-cy="revoke-confirm"
            >
              {submitting ? "Wird gesendet …" : "Widerrufen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
