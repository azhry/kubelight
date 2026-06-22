import {
  Box,
  Layers,
  Network,
  Folder,
  Server,
  FileText,
  Key,
  Activity,
  Globe,
  Terminal,
  ScrollText,
  Settings,
  Plus,
  Container,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { useNavigate, useLocation } from "react-router-dom";

interface NavItem {
  kind: string;
  label: string;
  icon: React.ReactNode;
}

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Workloads",
    items: [
      { kind: "pods", label: "Pods", icon: <Box className="h-4 w-4" /> },
      { kind: "deployments", label: "Deployments", icon: <Layers className="h-4 w-4" /> },
    ],
  },
  {
    title: "Network",
    items: [
      { kind: "services", label: "Services", icon: <Network className="h-4 w-4" /> },
      { kind: "ingresses", label: "Ingresses", icon: <Globe className="h-4 w-4" /> },
      { kind: "ingressclasses", label: "IngressClasses", icon: <Globe className="h-4 w-4" /> },
    ],
  },
  {
    title: "Cluster",
    items: [
      { kind: "namespaces", label: "Namespaces", icon: <Folder className="h-4 w-4" /> },
      { kind: "nodes", label: "Nodes", icon: <Server className="h-4 w-4" /> },
      { kind: "events", label: "Events", icon: <Activity className="h-4 w-4" /> },
    ],
  },
  {
    title: "Config",
    items: [
      { kind: "configmaps", label: "ConfigMaps", icon: <FileText className="h-4 w-4" /> },
      { kind: "secrets", label: "Secrets", icon: <Key className="h-4 w-4" /> },
    ],
  },
];

const bottomItems: { label: string; icon: React.ReactNode }[] = [
  { label: "Terminal", icon: <Terminal className="h-4 w-4" /> },
  { label: "Logs", icon: <ScrollText className="h-4 w-4" /> },
  { label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeKind = location.pathname.split("/")[1];

  return (
    <aside className="hidden md:flex flex-col h-full w-64 border-r border-outline-variant bg-surface flex-shrink-0 z-40">
      <div className="p-4 border-b border-outline-variant flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center border border-outline-variant">
          <Container className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="font-headline-md text-headline-md text-primary font-bold leading-tight">
            KubeLight
          </h1>
          <p className="font-label-sm text-label-sm text-on-surface-variant">Cluster connected</p>
        </div>
      </div>

      <div className="p-4">
        <Button
          disabled
          className="w-full bg-primary text-primary-foreground font-label-sm text-label-sm py-2 px-4 rounded flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> New Resource
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="px-4 py-2 font-label-sm text-label-sm text-outline uppercase tracking-wider mb-1">
              {section.title}
            </div>
            <ul className="flex flex-col gap-1 px-2">
              {section.items.map((item) => {
                const isActive = activeKind === item.kind;
                return (
                  <li key={item.kind}>
                    <button
                      onClick={() => navigate(`/${item.kind}`)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2 text-left font-label-sm text-label-sm transition-all duration-150 border-l-2",
                        isActive
                          ? "text-primary border-primary bg-surface-container-low font-bold"
                          : "text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container-high"
                      )}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-outline-variant mt-auto p-2 space-y-1">
        {bottomItems.map((item) => (
          <button
            key={item.label}
            disabled
            className="w-full flex items-center gap-3 px-4 py-2 rounded text-left font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
