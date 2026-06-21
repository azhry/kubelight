import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useNamespaces } from "../hooks/use-namespaces";

export function NamespaceFilter() {
  const { namespaces, selected, setSelected, loading } = useNamespaces();

  if (loading) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Namespace</label>
        <div className="h-10 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">Namespace</label>
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select namespace" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <span className="text-muted-foreground">All namespaces</span>
          </SelectItem>
          {namespaces.map((ns) => (
            <SelectItem key={ns} value={ns}>
              {ns}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
