"use client";
import { useEffect } from "react";
import { X } from "lucide-react";

export function ImageLightbox({
  src, alt, onClose,
}: {
  src: string | null;
  alt?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!src) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [src, onClose]);

  if (!src) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
        aria-label="Đóng"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={src}
        alt={alt ?? ""}
        className="max-h-full max-w-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
