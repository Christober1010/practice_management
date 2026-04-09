'use client';

interface SubmissionModalProps {
  isOpen: boolean;
  isSuccess: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export default function SubmissionModal({
  isOpen,
  isSuccess,
  title,
  message,
  onClose,
}: SubmissionModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 modal-backdrop transition-opacity duration-300 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all duration-300">
        <div className="flex justify-center mb-4">
          {isSuccess ? (
            <svg
              className="w-16 h-16 text-emerald-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ) : (
            <svg
              className="w-16 h-16 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </div>
        <h3
          className={`text-2xl font-bold text-center mb-3 ${
            isSuccess ? 'text-emerald-700' : 'text-red-600'
          }`}
        >
          {title}
        </h3>
        <p className="text-center text-slate-600 mb-6">{message}</p>
        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="bg-brand-600 text-white px-6 py-2 rounded-lg hover:bg-brand-700 transition shadow-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

