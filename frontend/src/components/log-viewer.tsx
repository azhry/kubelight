import { useRef, useEffect, useState } from "react";
import { Terminal, Play, Square, Search, ArrowDownToLine } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import type { LogLine } from "../hooks/use-log-stream";

interface LogViewerProps {
  logs: LogLine[];
  streaming: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function LogViewer({ logs, streaming, onStart, onStop }: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(atBottom);
  };

  const filteredLogs = filter
    ? logs.filter((l) => l.line.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  const timeStr = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString();
    } catch {
      return ts;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <Terminal className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Logs</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8 w-40 rounded-md border border-input bg-background pl-7 pr-2 text-xs outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <Button
            variant={streaming ? "destructive" : "default"}
            size="sm"
            onClick={streaming ? onStop : onStart}
          >
            {streaming ? (
              <><Square className="h-3 w-3 mr-1" /> Stop</>
            ) : (
              <><Play className="h-3 w-3 mr-1" /> Stream</>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoScroll(true)}
            className={cn(autoScroll && "text-primary")}
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto bg-black/90 p-4 font-mono text-xs leading-relaxed"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">
              {streaming ? "Waiting for logs..." : "Press Stream to start"}
            </p>
          </div>
        ) : (
          filteredLogs.map((log, i) => (
            <div key={i} className="flex gap-3 hover:bg-white/5">
              <span className="text-muted-foreground shrink-0 w-16 text-right">
                {timeStr(log.timestamp)}
              </span>
              <span className="text-gray-300 break-all">{log.line}</span>
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-1.5 border-t border-border text-xs text-muted-foreground shrink-0 flex items-center gap-2">
        <span>{logs.length} lines</span>
        {streaming && (
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            streaming
          </span>
        )}
        {!!filter && <span>({filteredLogs.length} filtered)</span>}
      </div>
    </div>
  );
}
