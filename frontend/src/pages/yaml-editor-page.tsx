import { useParams, useNavigate } from "react-router-dom";
import { FileText, Save, RotateCcw, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { CodeMirror } from "../components/codemirror";
import { DiffPreview } from "../components/diff-preview";
import { useYamlEditor } from "../hooks/use-yaml-editor";

export function YamlEditorPage() {
  const { kind = "pods", namespace = "default", name = "" } = useParams();
  const navigate = useNavigate();
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

  const readOnly = ["nodes", "events", "ingressclasses"].includes(kind);
  const displayNamespace = namespace === "-" ? "(cluster-scoped)" : namespace;

  return (
    <div className="h-full overflow-hidden flex flex-col bg-surface-dim">
      <header className="h-16 border-b border-outline-variant bg-surface-container px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-on-surface-variant hover:text-on-surface"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <FileText className="h-5 w-5 text-outline" />
          <div>
            <h1 className="font-headline-md text-headline-md text-on-surface">Edit YAML</h1>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              {kind} / {displayNamespace} / {name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {readOnly && (
            <span className="font-label-sm text-label-sm text-on-surface-variant px-2 py-1 rounded bg-surface-container-high">
              Read-only
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={resetYaml}
            disabled={saving || !hasChanges || readOnly}
            className="border-outline-variant text-on-surface hover:bg-surface-container-high"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={apply}
            disabled={saving || !hasChanges || readOnly}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? (
              <span className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Save className="h-3 w-3 mr-1" />
            )}
            Apply
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden p-4 md:p-6 space-y-4">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/3 rounded" />
            <Skeleton className="h-96 rounded-lg" />
          </div>
        ) : (
          <>
            <Card className="h-full flex flex-col border-outline-variant bg-surface-container rounded-lg overflow-hidden shadow-none">
              <CardContent className="flex-1 overflow-hidden p-0">
                <CodeMirror value={yamlStr} onChange={setYamlStr} readOnly={readOnly} />
              </CardContent>
            </Card>

            {hasChanges && (
              <div className="space-y-4">
                <DiffPreview original={originalYaml} modified={yamlStr} />
              </div>
            )}
          </>
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
