import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface DiffOp {
  type: "equal" | "insert" | "delete";
  value: string;
  oldLine?: number;
  newLine?: number;
}

function computeDiff(oldText: string, newText: string): DiffOp[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        oldLines[i] === newLines[j]
          ? 1 + dp[i + 1][j + 1]
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  let oldLine = 1;
  let newLine = 1;

  while (i < m || j < n) {
    if (i < m && j < n && oldLines[i] === newLines[j]) {
      ops.push({ type: "equal", value: oldLines[i], oldLine, newLine });
      i++;
      j++;
      oldLine++;
      newLine++;
    } else if (j < n && (i === m || dp[i][j + 1] >= dp[i + 1][j])) {
      ops.push({ type: "insert", value: newLines[j], newLine });
      j++;
      newLine++;
    } else if (i < m) {
      ops.push({ type: "delete", value: oldLines[i], oldLine });
      i++;
      oldLine++;
    } else {
      break;
    }
  }

  return ops;
}

interface DiffPreviewProps {
  original: string;
  modified: string;
}

export function DiffPreview({ original, modified }: DiffPreviewProps) {
  const ops = useMemo(() => computeDiff(original, modified), [original, modified]);

  return (
    <Card className="border-outline-variant bg-surface-container rounded-lg shadow-none flex flex-col max-h-[40vh]">
      <CardHeader className="p-4 pb-0">
        <CardTitle className="text-primary font-label-sm uppercase tracking-wider">
          Diff Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-auto">
        <div className="font-mono text-code-md">
          {ops.map((op, idx) => {
            const lineNum = op.oldLine ?? op.newLine ?? "";
            const sign = op.type === "insert" ? "+" : op.type === "delete" ? "-" : " ";
            const rowClass =
              op.type === "insert"
                ? "bg-primary/10 text-primary"
                : op.type === "delete"
                ? "bg-error/10 text-error"
                : "text-on-surface";
            return (
              <div
                key={idx}
                className={`flex hover:bg-surface-container-high/30 px-4 py-0.5 ${rowClass}`}
              >
                <span className="w-12 shrink-0 select-none text-on-surface-variant text-right pr-3">
                  {lineNum}
                </span>
                <span className="w-6 shrink-0 select-none text-on-surface-variant">{sign}</span>
                <span className="whitespace-pre break-all">{op.value}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
