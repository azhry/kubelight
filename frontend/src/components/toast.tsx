import { useState, useEffect, useCallback } from "react";
import { X, AlertCircle, CheckCircle, Info } from "lucide-react";
import { cn } from "../lib/utils";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;
const listeners: Array<(toast: Toast) => void> = [];

export function toast(message: string, type: ToastType = "info") {
  const t: Toast = { id: ++toastId, message, type };
  listeners.forEach((fn) => fn(t));
}

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-4 w-4 text-green-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
};

const bgMap: Record<ToastType, string> = {
  success: "border-green-500/30",
  error: "border-red-500/30",
  info: "border-blue-500/30",
};

export function ToastContainer() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (t: Toast) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, 4000);
    };
    listeners.push(handler);
    return () => {
      const i = listeners.indexOf(handler);
      if (i >= 0) listeners.splice(i, 1);
    };
  }, []);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "flex items-start gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg text-sm animate-in slide-in-from-right-2",
            bgMap[item.type]
          )}
        >
          {iconMap[item.type]}
          <p className="flex-1 text-foreground">{item.message}</p>
          <button onClick={() => remove(item.id)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
