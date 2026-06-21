import { Button } from "./components/ui/button";
import { Terminal, GitBranch, Container } from "lucide-react";

function App() {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Container className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold">KubeLight</h1>
        <span className="text-xs text-muted-foreground ml-auto">
          Kubernetes GUI — Rust + Tauri
        </span>
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

        <div className="flex justify-center gap-4 mb-12">
          <Button variant="default">
            <Terminal className="mr-2 h-4 w-4" />
            Get Started
          </Button>
          <Button variant="outline">
            <GitBranch className="mr-2 h-4 w-4" />
            GitHub
          </Button>
        </div>

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
