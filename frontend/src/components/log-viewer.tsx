import { useRef, useEffect, useState, useMemo } from "react";
import {
  Terminal,
  Play,
  Pause,
  Search,
  Trash2,
  ArrowDownToLine,
  ScrollText,
  Code,
  Send,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";
import { useExec } from "../hooks/use-exec";
import type { LogLine } from "../hooks/use-log-stream";

interface LogViewerProps {
  logs: LogLine[];
  streaming: boolean;
  onStart: () => void;
  onStop: () => void;
  onClear?: () => void;
  namespace?: string;
  podName?: string;
  container?: string;
  onYamlClick?: () => void;
}

const levelPatterns: { pattern: RegExp; className: string }[] = [
  { pattern: /\[ERR(?:OR)?\]/i, className: "terminal-error" },
  { pattern: /\[WARN(?:ING)?\]/i, className: "terminal-warn" },
  { pattern: /\[INFO\]/i, className: "terminal-info" },
];

function parseLogLine(log: LogLine) {
  const level = levelPatterns.find((lp) => lp.pattern.test(log.line));
  const levelText = log.line.match(/\[(ERR(?:OR)?|WARN(?:ING)?|INFO)\]/i)?.[0] || "";
  const message = levelText ? log.line.replace(levelText, "").trimStart() : log.line;
  return { level, levelText, message };
}

export function LogViewer({
  logs,
  streaming,
  onStart,
  onStop,
  onClear,
  namespace,
  podName,
  container,
  onYamlClick,
}: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const terminalScrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"logs" | "terminal" | "yaml">("logs");
  const { output, running: execRunning, exec, clearOutput } = useExec(
    namespace || "default",
    podName || "",
    container
  );
  const [command, setCommand] = useState("");

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [output]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(atBottom);
  };

  const filteredLogs = useMemo(() => {
    if (!filter) return logs;
    const lower = filter.toLowerCase();
    return logs.filter((l) => l.line.toLowerCase().includes(lower));
  }, [logs, filter]);

  const timeStr = (ts: string) => {
    try {
      return new Date(ts).toISOString();
    } catch {
      return ts;
    }
  };

  const handleTabClick = (tab: "logs" | "terminal" | "yaml") => {
    if (tab === "yaml") {
      onYamlClick?.();
      return;
    }
    setActiveTab(tab);
  };

  const handleExecSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    exec(command);
    setCommand("");
  };

  const TabButton = ({
    tab,
    label,
    icon: Icon,
  }: {
    tab: "logs" | "terminal" | "yaml";
    label: string;
    icon: React.ElementType;
  }) => {
    const isActive = activeTab === tab;
    return (
      <button
        onClick={() => handleTabClick(tab)}
        className={cn(
          "h-full flex items-center gap-2 font-label-sm text-label-sm transition-colors border-b-2",
          isActive
            ? "text-primary border-primary"
            : "text-on-surface-variant border-transparent hover:text-on-surface"
        )}
      >
        <Icon className="h-4 w-4" />
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between h-10 px-4 border-b border-outline-variant bg-surface-container-low shrink-0">
        <div className="flex items-center gap-6 h-full">
          <TabButton tab="logs" label="Logs" icon={ScrollText} />
          <TabButton tab="terminal" label="Terminal" icon={Terminal} />
          <TabButton tab="yaml" label="YAML" icon={Code} />
        </div>
        {activeTab === "logs" && (
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-outline-variant" />
              <input
                type="text"
                placeholder="Filter logs..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full h-8 bg-surface-container border border-outline-variant rounded py-1 pl-8 pr-2 text-on-surface font-code-md text-code-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-outline-variant"
              />
            </div>
            <div className="flex items-center gap-1 bg-surface-container rounded border border-outline-variant p-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-variant"
                onClick={streaming ? onStop : onStart}
                title={streaming ? "Pause streaming" : "Resume streaming"}
              >
                {streaming ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-variant"
                onClick={onClear}
                title="Clear logs"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <div className="w-px h-4 bg-outline-variant mx-1" />
              <label className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-surface-variant rounded transition-colors">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="h-3 w-3 rounded-sm border-outline-variant bg-transparent text-primary focus:ring-primary focus:ring-offset-surface-container"
                />
                <span className="font-label-sm text-label-sm text-on-surface-variant">Auto-scroll</span>
              </label>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAutoScroll(true)}
              className={cn(
                "h-7 w-7 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-variant",
                autoScroll && "text-primary"
              )}
              title="Scroll to bottom"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {activeTab === "logs" && (
        <>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-auto p-4 font-mono text-code-md bg-[#0a0e17]"
          >
            {filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-on-surface-variant">
                <p className="text-sm">
                  {streaming ? "Waiting for logs..." : "Press play to stream logs"}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredLogs.map((log, i) => {
                  const { level, levelText, message } = parseLogLine(log);
                  return (
                    <div
                      key={i}
                      className="flex hover:bg-surface-container-highest/30 px-2 -mx-2 rounded-sm transition-colors"
                    >
                      <span className="terminal-timestamp w-48 shrink-0 select-none">
                        {timeStr(log.timestamp)}
                      </span>
                      {levelText && (
                        <span className={cn("w-16 shrink-0", level?.className)}>{levelText}</span>
                      )}
                      <span className="terminal-text break-all">{message}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {streaming && (
              <div className="mt-2 flex">
                <span className="w-2 h-4 bg-primary animate-pulse inline-block shadow-[0_0_8px_rgba(107,251,154,0.6)]" />
              </div>
            )}
          </div>

          <div className="px-4 py-1.5 border-t border-outline-variant text-label-sm text-on-surface-variant shrink-0 flex items-center gap-2">
            <span>{logs.length} lines</span>
            {streaming && (
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                streaming
              </span>
            )}
            {!!filter && <span>({filteredLogs.length} filtered)</span>}
          </div>
        </>
      )}

      {activeTab === "terminal" && (
        <div className="flex-1 flex flex-col min-h-0 bg-[#0a0e17]">
          <div
            ref={terminalScrollRef}
            className="flex-1 overflow-auto p-4 font-mono text-code-md whitespace-pre-wrap"
          >
            {output ? (
              <span className="terminal-text">{output}</span>
            ) : (
              <div className="flex items-center justify-center h-full text-on-surface-variant">
                <p className="text-sm">Enter a command to exec into the pod</p>
              </div>
            )}
          </div>
          <form
            onSubmit={handleExecSubmit}
            className="border-t border-outline-variant p-2 flex items-center gap-2 bg-surface-container"
          >
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={`exec in ${podName || "pod"}...`}
              disabled={execRunning}
              className="flex-1 h-9 bg-surface-container border-outline-variant text-on-surface"
            />
            <Button
              type="submit"
              size="sm"
              disabled={execRunning || !command.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Send className="h-4 w-4 mr-1" />
              Run
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearOutput}
              className="border-outline-variant text-on-surface hover:bg-surface-container-high"
            >
              Clear
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
