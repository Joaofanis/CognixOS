import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Copy, Check, ClipboardList } from "lucide-react";

interface Props {
  content: string;
  isError?: boolean;
}

// ─── Color token map for :color[text] syntax ─────────────────────────────────
const COLOR_CLASSES: Record<string, string> = {
  red: "text-rose-400 font-medium",
  blue: "text-blue-400 font-medium",
  green: "text-emerald-400 font-medium",
  gold: "text-amber-400 font-medium",
  yellow: "text-yellow-400 font-medium",
  purple: "text-violet-400 font-medium",
  cyan: "text-cyan-400 font-medium",
  pink: "text-pink-400 font-medium",
  orange: "text-orange-400 font-medium",
  jade: "text-emerald-400 font-medium",
};

// ─── Pre-process content: :color[text] → HTML span, ==text== → <mark> ────────
function preprocessContent(raw: string): string {
  // ==highlight== → <mark>
  let out = raw.replace(/==(.+?)==/g, "<mark>$1</mark>");
  // :color[text] → span
  out = out.replace(/:(\w+)\[([^\]]+)\]/g, (_, color, text) => {
    const cls = COLOR_CLASSES[color];
    if (!cls) return text;
    return `<span class="${cls}">${text}</span>`;
  });
  return out;
}

// ─── Infographic block renderer ───────────────────────────────────────────────
const CHART_COLORS = [
  "#818cf8",
  "#fb923c",
  "#34d399",
  "#f472b6",
  "#60a5fa",
  "#a78bfa",
  "#fbbf24",
  "#4ade80",
];

function InfographicBlock({ raw }: { raw: string }) {
  type ChartData = { label: string; value: number };
  let type = "bar";
  let title = "";
  const data: ChartData[] = [];

  raw.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("type:")) type = trimmed.replace("type:", "").trim();
    else if (trimmed.startsWith("title:"))
      title = trimmed.replace("title:", "").trim();
    else if (trimmed.startsWith("- label:")) {
      data.push({ label: trimmed.replace("- label:", "").trim(), value: 0 });
    } else if (trimmed.startsWith("value:") && data.length > 0) {
      data[data.length - 1].value =
        parseFloat(trimmed.replace("value:", "").trim()) || 0;
    }
  });

  if (!data.length) return null;

  return (
    <div className="my-4 rounded-2xl border border-border/60 bg-card/80 p-4">
      {title && (
        <p className="text-sm font-semibold text-foreground mb-3">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={220}>
        {type === "pie" ? (
          <PieChart>
            <Pie
              data={data.map((d) => ({ name: d.label, value: d.value }))}
              cx="50%"
              cy="50%"
              outerRadius={80}
              dataKey="value"
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
            >
              {data.map((_, idx) => (
                <Cell
                  key={idx}
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        ) : type === "line" ? (
          <LineChart
            data={data.map((d) => ({ name: d.label, valor: d.value }))}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.07)"
            />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: "#1e1e2e",
                border: "1px solid #334155",
                borderRadius: 8,
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="valor"
              stroke={CHART_COLORS[0]}
              strokeWidth={2}
              dot={{ fill: CHART_COLORS[0] }}
            />
          </LineChart>
        ) : (
          // default: bar
          <BarChart data={data.map((d) => ({ name: d.label, valor: d.value }))}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.07)"
            />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: "#1e1e2e",
                border: "1px solid #334155",
                borderRadius: 8,
              }}
            />
            <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
              {data.map((_, idx) => (
                <Cell
                  key={idx}
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// ─── Table with copy button ───────────────────────────────────────────────────
function TableWrapper({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const tableRef = React.useRef<HTMLTableElement>(null);

  const handleCopyTable = async () => {
    if (!tableRef.current) return;
    const rows = Array.from(tableRef.current.querySelectorAll("tr"));
    const tsv = rows
      .map((row) =>
        Array.from(row.querySelectorAll("th, td"))
          .map((cell) => (cell as HTMLElement).innerText.trim())
          .join("\t"),
      )
      .join("\n");
    await navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-border/60 relative group/table">
      <button
        onClick={handleCopyTable}
        title="Copiar tabela"
        className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-primary/15 hover:bg-primary/30 text-primary border border-primary/20 opacity-0 group-hover/table:opacity-100 transition-all"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" />
            Copiado!
          </>
        ) : (
          <>
            <ClipboardList className="h-3 w-3" />
            Copiar
          </>
        )}
      </button>
      <table ref={tableRef} className="w-full text-sm border-collapse">
        {children}
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ObsidianMarkdown({ content, isError }: Props) {
  const safeContent = content || "";
  const rawText = isError
    ? safeContent.replace("⚠️ Erro:", "").trim()
    : safeContent;

  const text = preprocessContent(rawText);

  return (
    <div className="obsidian-md min-w-0 prose prose-sm dark:prose-invert max-w-none prose-p:mb-3 prose-p:leading-relaxed prose-headings:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-p:text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm as never]}
        components={{
          // ── Headings ──────────────────────────────────────────────────────
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mt-4 mb-2 pb-1 border-b border-border/50 text-foreground">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold mt-3 mb-2 text-foreground">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-2 mb-1 text-foreground">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold mt-2 mb-1 text-foreground">
              {children}
            </h4>
          ),

          // ── Paragraphs ─────────────────────────────────────────────────────
          p: ({ children }) => (
            <p className="text-sm leading-relaxed mb-3 last:mb-0 text-foreground">
              {children}
            </p>
          ),

          // ── Bold → amber/gold highlight ────────────────────────────────────
          strong: ({ children }) => (
            <strong className="font-bold text-amber-400">{children}</strong>
          ),

          // ── Italic → jade/emerald ─────────────────────────────────────────
          em: ({ children }) => (
            <em className="italic text-emerald-400">{children}</em>
          ),

          // ── Inline mark (==text==) ─────────────────────────────────────────
          // react-markdown passes HTML tags through when rehype-raw is used;
          // we handle them via the preprocessor span injection above.

          // ── Code ──────────────────────────────────────────────────────────
          code: ({ className, children, ...props }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              const lang = (className || "").replace("language-", "");
              // Detect infographic block
              if (lang === "infographic" || lang === "chart") {
                return <InfographicBlock raw={String(children)} />;
              }
              return (
                <code className={`${className} text-[0.85em]`} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="px-1.5 py-0.5 rounded-md bg-primary/15 text-primary text-[0.8em] font-mono border border-primary/25">
                {children}
              </code>
            );
          },

          pre: ({ children }) => (
            <pre className="my-3 rounded-xl bg-[#1a1a2e] border border-border/50 overflow-x-auto px-4 py-3 text-xs font-mono text-[#e2e8f0] leading-relaxed">
              {children}
            </pre>
          ),

          // ── Blockquote ─────────────────────────────────────────────────────
          blockquote: ({ children }) => (
            <blockquote className="my-3 pl-4 border-l-4 border-primary/70 bg-primary/8 rounded-r-xl py-2 pr-3 text-sm text-foreground italic">
              {children}
            </blockquote>
          ),

          // ── Lists ──────────────────────────────────────────────────────────
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-5 space-y-1 mb-3 text-sm text-foreground">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-5 space-y-1 mb-3 text-sm text-foreground">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed text-foreground">{children}</li>
          ),

          // ── Links ──────────────────────────────────────────────────────────
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              {children}
            </a>
          ),

          hr: () => <hr className="my-4 border-border/40" />,

          // ── Tables with copy button ────────────────────────────────────────
          table: ({ children }) => <TableWrapper>{children}</TableWrapper>,

          thead: ({ children }) => (
            <thead className="bg-primary/20 border-b-2 border-primary/30">
              {children}
            </thead>
          ),

          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-foreground border-r border-border/30 last:border-r-0">
              {children}
            </th>
          ),

          td: ({ children }) => (
            <td className="px-4 py-2.5 text-sm text-foreground border-r border-border/20 last:border-r-0">
              {children}
            </td>
          ),

          tr: ({ children }) => (
            <tr className="border-b border-border/40 last:border-0 even:bg-muted/20 hover:bg-primary/8 transition-colors duration-150">
              {children}
            </tr>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
