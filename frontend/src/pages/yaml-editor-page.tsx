import { useState } from "react";
import { useParams } from "react-router-dom";
import { FileText, Save, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { CodeMirror } from "../components/codemirror";
import { useYamlEditor } from "../hooks/use-yaml-editor";

export function YamlEditorPage() {
  const { kind = "pods" } = useParams();
  const {
    resources,
    yamlStr,
    setYamlStr,
    loading,
    saving,
    error,
    hasChanges,
    fetchYaml,
    applyPatch,
    resetYaml,
  } = useYamlEditor(kind, undefined);
  const [selectedResource, setSelectedResource] = useState("");

  const handleSelectResource = (name: string) => {
    setSelectedResource(name);
    fetchYaml(name);
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-border px-6 py-3 flex items-center gap-3 shrink-0">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h1 className="text-sm font-semibold">YAML Editor</h1>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={selectedResource}
            onChange={(e) => handleSelectResource(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Select resource...</option>
            {resources.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
          {hasChanges && (
            <>
              <Button variant="outline" size="sm" onClick={resetYaml} disabled={saving}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={() => applyPatch(selectedResource)}
                disabled={saving || !selectedResource}
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Apply
              </Button>
            </>
          )}
        </div>
      </div>

      {!selectedResource ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p className="text-sm">Select a resource to edit its YAML</p>
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <CodeMirror value={yamlStr} onChange={setYamlStr} />
        </div>
      )}

      {error && (
        <div className="px-4 py-2 border-t border-border bg-red-500/10 text-sm text-red-500">
          {error}
        </div>
      )}
    </div>
  );
}
