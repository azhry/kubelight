import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useKubeContext } from "../hooks/use-kube-context";

export function ContextSelector() {
  const { contexts, activeContext, loading, switchContext } = useKubeContext();

  if (loading) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Context</label>
        <div className="h-10 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">Context</label>
      <Select value={activeContext} onValueChange={switchContext}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select context" />
        </SelectTrigger>
        <SelectContent>
          {contexts.map((ctx) => (
            <SelectItem key={ctx.name} value={ctx.name}>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    ctx.active ? "bg-green-500" : "bg-muted-foreground"
                  }`}
                />
                <span>{ctx.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
