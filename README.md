# KubeLight

Ultra-lightweight Kubernetes GUI desktop app built with **Rust + Tauri v2**.

## Overview

KubeLight is a cross-platform desktop application for managing Kubernetes clusters. It provides a clean, dark-themed UI for browsing resources, streaming logs, editing YAML, and switching contexts — all without the overhead of traditional K8s dashboards.

## Features

- **Context Selector** — Switch between kubeconfig contexts
- **Namespace Filter** — Global or scoped namespace filtering
- **Resource Browser** — List and inspect all K8s kinds (pods, deployments, services, etc.)
- **Log Viewer** — Real-time log streaming with search and auto-scroll
- **YAML Editor** — Syntax-highlighted editor with diff preview and apply
- **Resource Operations** — Scale deployments, patch resources

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Rust + Tauri v2 + kube-rs |
| IPC | Tauri commands (invoke) |
| Styling | Tailwind CSS dark theme |

## Getting Started

### Prerequisites

- Rust 1.90+ — [rustup](https://rustup.rs)
- Node.js 18+ — [nodejs.org](https://nodejs.org)
- Cargo — included with Rust

### Development

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend (from repo root)
cargo build
cargo tauri dev
```

### Build

```bash
cargo tauri build
```

## Project Structure

```
kubelight/
├── frontend/          # Vite + React + Tailwind
│   ├── src/
│   │   ├── components/
│   │   ├── lib/
│   │   └── pages/
│   └── ...
├── src-tauri/         # Rust + Tauri backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── context.rs
│   │   ├── resources.rs
│   │   ├── logs.rs
│   │   └── operations.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
└── README.md
```

## License

MIT
