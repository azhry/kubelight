import { FileText, Save, RotateCcw, X } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { CodeMirror } from "./codemirror";
import { DiffPreview } from "./diff-preview";
import { useYamlEditor } from "../hooks/use-yaml-editor";
import { useYamlPanel } from "../hooks/use-yaml-panel";

export function YamlEditorPanel() {
  const { resource, closeYamlPanel } = useYamlPanel();
  const { kind, namespace, name } = resource || { kind: "", namespace: "", name: "" };
  const {
    yamlStr,
    setYamlStr,
    originalYaml,
    loading,
    saving,
    error,
    hasChanges,
    apply,
    resetYaml,
  } = useYamlEditor(kind, namespace, name);

  if (!resource) return null;

  const readOnly = ["nodes", "events", "ingressclasses"].includes(kind);
  const displayNamespace = namespace === "-" ? "(cluster-scoped)" : namespace;

  return (
    <div className="h-[45%] max-h-[50vh] min-h-[200px] border-t border-outline-variant flex flex-col bg-surface shrink-0">
      <header className="h-12 border-b border-outline-variant bg-surface-container px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-outline" />
          <div className="flex items-center gap-2">
            <h2 className="font-label-lg text-label-lg text-on-surface">Edit YAML</h2>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              {kind} / {displayNamespace} / {name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {readOnly && (
            <span className="font-label-sm text-label-sm text-on-surface-variant px-2 py-0.5 rounded bg-surface-container-high">
              Read-only
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={resetYaml}
            disabled={saving || !hasChanges || readOnly}
            className="h-8 border-outline-variant text-on-surface hover:bg-surface-container-high"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={apply}
            disabled={saving || !hasChanges || readOnly}
            className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? (
              <span className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Save className="h-3 w-3 mr-1" />
            )}
            Apply
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeYamlPanel}
            aria-label="Close YAML editor"
            className="h-8 w-8 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden p-4 space-y-4">
        {loading ? (
          <div className="space-y-4 h-full">
            <Skeleton className="h-8 w-1/3 rounded" />
            <Skeleton className="h-full rounded-lg" />
          </div>
        ) : (
          <Card className="h-full flex flex-col border-outline-variant bg-surface-container rounded-lg overflow-hidden shadow-none">
            <CardContent className="flex-1 overflow-hidden p-0">
              <CodeMirror value={yamlStr} onChange={setYamlStr} readOnly={readOnly} />
            </CardContent>
          </Card>
        )}

        {hasChanges && !loading && (
          <div className="space-y-4">
            <DiffPreview original={originalYaml} modified={yamlStr} />
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 border-t border-outline-variant bg-destructive/10 text-sm text-destructive flex items-center gap-2">
          <span className="font-medium">Error:</span>
          {error}
        </div>
      )}
    </div>
  );
}
