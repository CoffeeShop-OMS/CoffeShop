import { useEffect, useState } from 'react';

export default function ConfirmModal({ open = false, title = 'Confirm', message = '', onConfirm, onCancel }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) setVisible(true);
  }, [open]);

  if (!open && !visible) return null;

  const handleClose = (cb) => {
    setVisible(false);
    // allow animation to play
    setTimeout(() => {
      if (typeof cb === 'function') cb();
    }, 180);
  };

  const handleConfirm = () => handleClose(onConfirm);
  const handleCancel = () => handleClose(onCancel);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center`} aria-modal="true" role="dialog">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleCancel}
      />

      <div className={`relative w-full max-w-md mx-4 sm:mx-0 transition-transform ${visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
        <div className="bg-white rounded-2xl p-5 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-600 mb-4">{message}</p>

          <div className="flex justify-end gap-3">
            <button
              onClick={handleCancel}
              className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-3 py-2 rounded-lg bg-[#3D261D] text-white text-sm hover:bg-[#2A1A14] transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
