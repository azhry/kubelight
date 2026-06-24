import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, CheckCircle2, FileJson, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "./toast";
import { invoke } from "@tauri-apps/api/core";

export interface KubeconfigSession {
  id: string;
  label: string;
  path: string;
  active: boolean;
}

export function KubeconfigMenu() {
  const [sessions, setSessions] = useState<KubeconfigSession[]>([]);
  const [newPath, setNewPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const list = await invoke<KubeconfigSession[]>("list_kubeconfigs");
      setSessions(list || []);
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPath.trim();
    if (!trimmed) return;

    setAdding(true);
    try {
      await invoke("add_kubeconfig", { path: trimmed, label: null });
      setNewPath("");
      await loadSessions();
    } catch (err) {
      toast(String(err), "error");
    } finally {
      setAdding(false);
    }
  };

  const handleSwitch = async (id: string) => {
    try {
      await invoke("switch_kubeconfig", { id });
      await loadSessions();
    } catch (err) {
      toast(String(err), "error");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await invoke("remove_kubeconfig", { id });
      await loadSessions();
    } catch (err) {
      toast(String(err), "error");
    }
  };

  return (
    <aside className="w-16 border-r border-outline-variant bg-surface-container-low flex flex-col h-full shrink-0">
      <div className="h-14 border-b border-outline-variant flex items-center justify-center shrink-0">
        <FileJson className="h-5 w-5 text-primary" />
      </div>

      <div className="flex-1 overflow-y-auto py-2 space-y-2">
        {loading && sessions.length === 0 ? (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
          </div>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => handleSwitch(session.id)}
              title={`${session.label}\n${session.path}`}
              className={`w-full flex flex-col items-center gap-1 px-1 py-2 text-xs transition-colors ${
                session.active
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <div className="relative">
                <FileJson className="h-6 w-6" />
                {session.active && (
                  <CheckCircle2 className="h-3 w-3 absolute -bottom-0.5 -right-0.5 text-primary fill-primary/20" />
                )}
              </div>
              <span className="truncate w-full text-center px-0.5 leading-tight">
                {session.label}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(session.id);
                }}
                title="Remove kubeconfig"
                className="opacity-0 group-hover:opacity-100 hover:text-destructive focus:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </button>
          ))
        )}
      </div>

      <form
        onSubmit={handleAdd}
        className="border-t border-outline-variant p-2 flex flex-col gap-2 shrink-0"
      >
        <Input
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          placeholder="Path..."
          disabled={adding}
          className="h-8 text-xs px-2 bg-surface-container border-outline-variant text-on-surface placeholder:text-muted-foreground"
        />
        <Button
          type="submit"
          size="sm"
          disabled={adding || !newPath.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {adding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </form>
    </aside>
  );
}
