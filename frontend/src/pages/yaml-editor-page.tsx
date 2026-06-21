import { useState } from "react";
import { useParams } from "react-router-dom";
import { FileText, Save, RotateCcw } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { CodeMirror } from "../components/codemirror";
import { DiffPreview } from "../components/diff-preview";
import { useYamlEditor } from "../hooks/use-yaml-editor";

export function YamlEditorPage() {
  const { kind = "pods" } = useParams();
  const {
    resources,
    yamlStr,
    setYamlStr,
    originalYaml,
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
    <div className="flex-1 flex flex-col bg-surface-dim">
      <header className="h-16 border-b border-outline-variant bg-surface-container px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-outline" />
          <h1 className="font-headline-md text-headline-md text-on-surface">YAML Editor</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedResource} onValueChange={handleSelectResource}>
            <SelectTrigger className="h-9 w-64 rounded border-outline-variant bg-surface-container-low px-3 py-1.5 font-code-md text-sm text-on-surface hover:border-primary focus:ring-1 focus:ring-primary focus:ring-offset-0">
              <SelectValue placeholder="Select resource..." />
            </SelectTrigger>
            <SelectContent className="border-outline-variant bg-surface-container text-on-surface">
              {resources.map((r) => (
                <SelectItem
                  key={r.name}
                  value={r.name}
                  className="focus:bg-surface-container-high focus:text-on-surface"
                >
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        {!selectedResource ? (
          <div className="flex-1 flex items-center justify-center text-on-surface-variant min-h-[200px]">
            <p className="text-sm">Select a resource to edit its YAML</p>
          </div>
        ) : loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/3 rounded" />
            <Skeleton className="h-96 rounded-lg" />
          </div>
        ) : (
          <>
            <Card className="border-outline-variant bg-surface-container rounded-lg overflow-hidden shadow-none">
              <CardContent className="p-0 h-[50vh]">
                <CodeMirror value={yamlStr} onChange={setYamlStr} />
              </CardContent>
            </Card>

            {hasChanges && (
              <div className="space-y-4">
                <DiffPreview original={originalYaml} modified={yamlStr} />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetYaml}
                    disabled={saving}
                    className="border-outline-variant text-on-surface hover:bg-surface-container-high"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => applyPatch(selectedResource)}
                    disabled={saving || !selectedResource}
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
