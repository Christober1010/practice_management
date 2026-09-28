'use client';

import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface LogoutConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function LogoutConfirmationModal({
  isOpen,
  onConfirm,
  onCancel,
}: LogoutConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black bg-opacity-50 z-50 transition-opacity duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all duration-300">
        <div className="flex justify-center mb-4">
          <div className="bg-amber-100 rounded-full p-3">
            <LogOut className="w-8 h-8 text-amber-600" />
          </div>
        </div>
        <h3 className="text-2xl font-bold text-center mb-3 text-slate-800">
          Confirm Logout
        </h3>
        <p className="text-center text-slate-600 mb-6">
          Are you sure you want to sign out? You'll need to log in again to access your account.
        </p>
        <div className="flex gap-3 justify-center">
          <Button
            onClick={onCancel}
            variant="outline"
            className="min-w-[100px]"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-teal-600 hover:bg-teal-700 min-w-[100px]"
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}

