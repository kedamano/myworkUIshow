import { useEffect } from "react";
import { X } from "lucide-react";

const useEscape = (open, onClose) => {
  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);
};

export const Modal = ({ open, onClose, title, description, children, footer, width = "max-w-lg" }) => {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className={`relative w-full ${width} bg-white rounded-sm shadow-xl my-auto`}>
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#f0f0f0]">
          <div>
            <h2 className="text-[16px] font-medium text-[#161616]">{title}</h2>
            {description ? <p className="text-[12px] text-[#8d8d8d] mt-0.5">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#f4f4f4] text-[#8d8d8d] transition-colors"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#f0f0f0] bg-[#fafafa]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const Drawer = ({ open, onClose, title, subtitle, children, footer, width = "max-w-xl" }) => {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className={`relative h-full w-full ${width} bg-white shadow-2xl flex flex-col`}>
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#f0f0f0]">
          <div>
            <h2 className="text-[16px] font-medium text-[#161616]">{title}</h2>
            {subtitle ? <p className="text-[12px] text-[#8d8d8d] mt-0.5">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#f4f4f4] text-[#8d8d8d] transition-colors"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#f0f0f0] bg-[#fafafa]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};
