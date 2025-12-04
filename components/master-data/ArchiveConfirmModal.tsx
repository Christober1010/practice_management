// components/ArchiveConfirmModal.tsx
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
import { Archive, ArchiveRestore } from "lucide-react";

type ArchiveConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  domainName: string;
  willArchive: boolean;   // true → archive, false → restore
  loading?: boolean;
};

export default function ArchiveConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  domainName,
  willArchive,
  loading = false,
}: ArchiveConfirmModalProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {willArchive ? (
              <Archive className="h-5 w-5 text-amber-600" />
            ) : (
              <ArchiveRestore className="h-5 w-5 text-green-600" />
            )}
            {willArchive ? "Archive" : "Restore"} Domain
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-600">
            Are you sure you want to{" "}
            <strong>{willArchive ? "archive" : "restore"}</strong> the domain{" "}
            <span className="font-semibold text-slate-800">"{domainName}"</span>
            ? {willArchive ? "It will disappear from the active list." : "It will become active again."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className={willArchive ? "bg-amber-600 hover:bg-amber-700" : "bg-green-600 hover:bg-green-700"}
          >
            {loading ? "Processing…" : willArchive ? "Archive" : "Restore"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}