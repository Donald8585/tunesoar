import { useState, useEffect, useCallback } from "react";
import { XCircle, AlertTriangle, X } from "lucide-react";

type ToastLevel = "error" | "warning";

interface Toast {
  id: number;
  message: string;
  level: ToastLevel;
  prefix: string;
}

let toastId = 0;

// Global toast queue — call addToast() from anywhere
const listeners = new Set<(toasts: Toast[]) => void>();
let currentToasts: Toast[] = [];

function notify() {
  for (const fn of listeners) fn([...currentToasts]);
}

export function addToast(prefix: string, message: string, level: ToastLevel = "error") {
  const id = ++toastId;
  const toast: Toast = { id, message, level, prefix };
  currentToasts = [...currentToasts, toast];
  notify();
  // Auto-dismiss after 6s
  setTimeout(() => {
    currentToasts = currentToasts.filter((t) => t.id !== id);
    notify();
  }, 6000);
}

export function ErrorToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    listeners.add(setToasts);
    return () => { listeners.delete(setToasts); };
  }, []);

  const dismiss = useCallback((id: number) => {
    currentToasts = currentToasts.filter((t) => t.id !== id);
    notify();
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2 px-4 py-3 rounded-xl border shadow-lg animate-in slide-in-from-bottom-4 ${
            t.level === "error"
              ? "bg-red-900/90 border-red-600/40 text-red-200"
              : "bg-amber-900/90 border-amber-600/40 text-amber-200"
          }`}
        >
          {t.level === "error" ? (
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-mono opacity-60 block">
              [{t.prefix}]
            </span>
            <span className="text-xs">{t.message}</span>
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="p-0.5 rounded hover:bg-white/10 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
