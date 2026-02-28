import React from "react";

interface Props {
  content: string;
  isError?: boolean;
}

// ---------------------------------------------------------------------------
// Inline-text parser: bold, italic, code, links
// ---------------------------------------------------------------------------
function parseInline(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  // tokens: **bold**, *italic*, `code`, [label](url)
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) result.push(text.slice(last, m.index));
    if (m[2] !== undefined)
      result.push(
        <strong key={key++} className="font-semibold text-foreground">
          {m[2]}
        </strong>,
      );
    else if (m[3] !== undefined)
      result.push(
        <em key={key++} className="italic text-foreground/80">
          {m[3]}
        </em>,
      );
    else if (m[4] !== undefined)
      result.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[0.8em] font-mono border border-primary/20"
        >
          {m[4]}
        </code>,
      );
    else if (m[5] !== undefined)
      result.push(
        <a
          key={key++}
          href={m[6]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
        >
          {m[5]}
        </a>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) result.push(text.slice(last));
  return result;
}

// ---------------------------------------------------------------------------
// Block-level parser
// ---------------------------------------------------------------------------
function parseBlocks(markdown: string): React.ReactNode[] {
  const lines = markdown.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // --- Fenced code block ---
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre
          key={key++}
          className="my-3 rounded-xl bg-[#1e1e2e] border border-border/40 overflow-x-auto"
        >
          <div className="px-4 py-3 text-xs font-mono text-[#cdd6f4] leading-relaxed whitespace-pre">
            {codeLines.join("\n")}
          </div>
        </pre>,
      );
      i++; // skip closing ```
      continue;
    }

    // --- Table ---
    if (line.includes("|") && lines[i + 1]?.match(/^[\s|:-]+$/)) {
      const headers = line
        .split("|")
        .map((h) => h.trim())
        .filter(Boolean);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        rows.push(
          lines[i]
            .split("|")
            .map((c) => c.trim())
            .filter(Boolean),
        );
        i++;
      }
      nodes.push(
        <div
          key={key++}
          className="my-3 overflow-x-auto rounded-xl border border-border/50"
        >
          <table className="w-full text-sm border-collapse">
            <thead className="bg-primary/10 text-foreground font-semibold">
              <tr>
                {headers.map((h, j) => (
                  <th
                    key={j}
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-foreground/70 border-b border-border/50"
                  >
                    {parseInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-primary/5 transition-colors">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-2.5 text-foreground/85">
                      {parseInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // --- Headings ---
    const h4 = line.match(/^####\s+(.*)/);
    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);
    if (h4) {
      nodes.push(
        <h4
          key={key++}
          className="text-sm font-semibold mt-2 mb-1 text-foreground"
        >
          {parseInline(h4[1])}
        </h4>,
      );
      i++;
      continue;
    }
    if (h3) {
      nodes.push(
        <h3
          key={key++}
          className="text-base font-semibold mt-2 mb-1 text-foreground"
        >
          {parseInline(h3[1])}
        </h3>,
      );
      i++;
      continue;
    }
    if (h2) {
      nodes.push(
        <h2
          key={key++}
          className="text-lg font-semibold mt-3 mb-2 text-foreground"
        >
          {parseInline(h2[1])}
        </h2>,
      );
      i++;
      continue;
    }
    if (h1) {
      nodes.push(
        <h1
          key={key++}
          className="text-xl font-bold mt-4 mb-2 pb-1 border-b border-border/50 text-foreground"
        >
          {parseInline(h1[1])}
        </h1>,
      );
      i++;
      continue;
    }

    // --- Blockquote ---
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <blockquote
          key={key++}
          className="my-3 pl-4 border-l-4 border-primary/60 bg-primary/5 rounded-r-xl py-2 pr-3 text-sm text-foreground/80 italic"
        >
          {parseInline(quoteLines.join(" "))}
        </blockquote>,
      );
      continue;
    }

    // --- HR ---
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      nodes.push(<hr key={key++} className="my-4 border-border/40" />);
      i++;
      continue;
    }

    // --- Unordered list ---
    if (line.match(/^[-*+]\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*+]\s+/)) {
        items.push(lines[i].replace(/^[-*+]\s+/, ""));
        i++;
      }
      nodes.push(
        <ul
          key={key++}
          className="list-disc list-outside pl-5 space-y-1 mb-3 text-sm text-foreground/90"
        >
          {items.map((it, j) => (
            <li key={j} className="leading-relaxed">
              {parseInline(it)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // --- Ordered list ---
    if (line.match(/^\d+\.\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      nodes.push(
        <ol
          key={key++}
          className="list-decimal list-outside pl-5 space-y-1 mb-3 text-sm text-foreground/90"
        >
          {items.map((it, j) => (
            <li key={j} className="leading-relaxed">
              {parseInline(it)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // --- Blank line ---
    if (line.trim() === "") {
      i++;
      continue;
    }

    // --- Paragraph ---
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith(">") &&
      !lines[i].match(/^[-*+]\s+/) &&
      !lines[i].match(/^\d+\.\s+/) &&
      !lines[i].startsWith("```") &&
      !lines[i].match(/^---+$/) &&
      !lines[i].includes("|")
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      nodes.push(
        <p
          key={key++}
          className="text-sm leading-relaxed mb-3 last:mb-0 text-foreground/90"
        >
          {parseInline(paraLines.join(" "))}
        </p>,
      );
    }
  }
  return nodes;
}

export default function ObsidianMarkdown({ content, isError }: Props) {
  const safeContent = content || "";
  const text = isError
    ? safeContent.replace("⚠️ Erro:", "").trim()
    : safeContent;
  return <div className="obsidian-md min-w-0">{parseBlocks(text)}</div>;
}
