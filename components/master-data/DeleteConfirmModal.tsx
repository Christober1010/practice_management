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
  /** Used by legacy delete-module flows when title/message are omitted. */
  moduleName?: string;
  /** Optional: override heading (e.g. archive flows). */
  title?: string;
  /** Optional: override description body. */
  message?: string;
  /** Primary action label override. */
  confirmLabel?: string;
  variant?: "delete" | "archive";
};

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  moduleName = "",
  title,
  message,
  confirmLabel,
  loading = false,
  variant,
}: DeleteConfirmModalProps) {
  const useArchiveUi = variant === "archive";
  const Icon = useArchiveUi ? Archive : Trash2;

  const heading =
    title ||
    (useArchiveUi ? "Archive?" : "Delete module");

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
        Are you sure you want to delete the module{" "}
        <span className="font-semibold text-slate-800">&quot;{moduleName}&quot;</span>? This action{" "}
        <strong>cannot be undone</strong> and will permanently remove the module from the system.
      </>
    );
  })();

  const actionIdleLabel = confirmLabel ?? (useArchiveUi ? "Archive" : "Delete module");

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
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
            onClick={onConfirm}
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
