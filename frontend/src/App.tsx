import { Container } from "lucide-react";
import { ContextSelector } from "./components/context-selector";
import { NamespaceFilter } from "./components/namespace-filter";

function App() {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <Container className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold">KubeLight</h1>
        <div className="ml-auto flex items-center gap-4 min-w-0">
          <div className="w-56">
            <ContextSelector />
          </div>
          <div className="w-48">
            <NamespaceFilter />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto mt-24 px-6 text-center">
        <Container className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
        <h2 className="text-2xl font-bold mb-2">
          KubeLight Frontend
        </h2>
        <p className="text-muted-foreground mb-8">
          Ultra-lightweight Kubernetes GUI desktop app.
          <br />
          Built with React + Tailwind + Tauri v2.
        </p>

        <div className="grid grid-cols-3 gap-4 text-left">
          {[
            { title: "Context Selector", desc: "Switch k8s contexts" },
            { title: "Resource List", desc: "Browse all K8s kinds" },
            { title: "Log Viewer", desc: "Stream pod logs live" },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-lg border border-border bg-card p-4"
            >
              <h3 className="font-medium text-sm mb-1">{item.title}</h3>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;
