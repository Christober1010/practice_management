import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Archive, Trash2 } from "lucide-react";

type DeleteConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  /** Display name of the item being deleted/archived. */
  moduleName?: string;
  /**
   * Entity kind for default copy (e.g. "domain", "program", "target", "module").
   * Used when title / message / confirmLabel are omitted.
   */
  entityType?: string;
  /** Optional: override heading (e.g. archive flows). */
  title?: string;
  /** Optional: override description body. */
  message?: string;
  /** Primary action label override. */
  confirmLabel?: string;
  variant?: "delete" | "archive";
};

function formatEntityLabel(entityType?: string) {
  const raw = String(entityType || "item").trim();
  if (!raw) return "Item";
  return raw
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  moduleName = "",
  entityType,
  title,
  message,
  confirmLabel,
  loading = false,
  variant,
}: DeleteConfirmModalProps) {
  const useArchiveUi = variant === "archive";
  const Icon = useArchiveUi ? Archive : Trash2;
  const entityLabel = formatEntityLabel(entityType);
  const entityLower = entityLabel.toLowerCase();

  const heading =
    title ||
    (useArchiveUi ? `Archive ${entityLabel}?` : `Delete ${entityLabel}?`);

  const descriptionBody = (() => {
    if (message) return message;
    if (!moduleName.trim()) return null;
    if (useArchiveUi) {
      return (
        <>
          Archive <span className="font-semibold text-slate-800">&quot;{moduleName}&quot;</span>?
          You may be able to restore it from archived views where applicable.
        </>
      );
    }
    return (
      <>
        Are you sure you want to delete the {entityLower}{" "}
        <span className="font-semibold text-slate-800">&quot;{moduleName}&quot;</span>? This action{" "}
        <strong>cannot be undone</strong> and will permanently remove it from the system.
      </>
    );
  })();

  const actionIdleLabel =
    confirmLabel ?? (useArchiveUi ? "Archive" : `Delete ${entityLabel}`);

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        // Only react to close; ignore open=true. Callers often clear the
        // pending row in onClose — that must not run before Confirm's onClick.
        if (!open) onClose();
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle
            className={`flex items-center gap-2 ${useArchiveUi ? "text-amber-700" : "text-red-600"}`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {heading}
          </AlertDialogTitle>
          {descriptionBody && (
            <AlertDialogDescription className="text-slate-600">{descriptionBody}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Prevent Dialog.Close from flipping open→false in the same tick,
              // which clears parent state and makes async delete handlers no-op.
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className={
              useArchiveUi
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
            }
          >
            {loading ? (useArchiveUi ? "Archiving..." : "Deleting...") : actionIdleLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
