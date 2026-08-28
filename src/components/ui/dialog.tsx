import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

// Tono del panel: "success" lo tiñe de verde para estados ya resueltos
// positivamente (p. ej. "ya está entregado"), sin afectar el resto de usos.
const toneClass: Record<"default" | "success", string> = {
  default: "border-border bg-card",
  success:
    "border-green-300 bg-green-50 text-green-950 dark:border-green-800 dark:bg-green-950 dark:text-green-50",
};

export function Dialog({
  open,
  onClose,
  title,
  children,
  tone = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  tone?: "default" | "success";
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        className={`relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border p-6 shadow-lg ${toneClass[tone]}`}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
