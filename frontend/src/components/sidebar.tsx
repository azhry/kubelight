import {
  Box,
  Layers,
  Network,
  Folder,
  Server,
  FileText,
  Key,
  Activity,
  Code,
  ChevronRight,
} from "lucide-react";
import { cn } from "../lib/utils";
import { resourceKinds } from "../lib/resource-kinds";
import { useNavigate, useLocation } from "react-router-dom";

const iconMap: Record<string, React.ReactNode> = {
  Box: <Box className="h-4 w-4" />,
  Layers: <Layers className="h-4 w-4" />,
  Network: <Network className="h-4 w-4" />,
  Folder: <Folder className="h-4 w-4" />,
  Server: <Server className="h-4 w-4" />,
  FileText: <FileText className="h-4 w-4" />,
  Key: <Key className="h-4 w-4" />,
  Activity: <Activity className="h-4 w-4" />,
};

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isYamlPage = location.pathname.startsWith("/yaml");
  const activeKind = isYamlPage ? undefined : location.pathname.slice(1);

  return (
    <aside className="w-60 border-r border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Resources
        </h2>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {resourceKinds.map((item) => {
          const isActive = activeKind === item.kind;
          return (
            <button
              key={item.kind}
              onClick={() => navigate(`/${item.kind}`)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              {iconMap[item.icon]}
              <span className="flex-1 text-left">{item.label}</span>
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  isActive ? "opacity-100" : "opacity-0"
                )}
              />
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        <button
          onClick={() => navigate("/yaml/pods")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
            isYamlPage
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <Code className="h-4 w-4" />
          <span className="flex-1 text-left">YAML Editor</span>
        </button>
      </div>
    </aside>
  );
}
