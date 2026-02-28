import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

// Rich Markdown renderer styled like Obsidian Reading Mode
const components: Components = {
  // Headings
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

  // Paragraphs — proper spacing
  p: ({ children }) => (
    <p className="text-sm leading-relaxed mb-3 last:mb-0 text-foreground/90">
      {children}
    </p>
  ),

  // Inline code
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) return null; // handled by pre
    return (
      <code className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[0.8em] font-mono border border-primary/20">
        {children}
      </code>
    );
  },

  // Code blocks
  pre: ({ children }) => (
    <pre className="my-3 rounded-xl bg-[#1e1e2e] border border-border/40 overflow-x-auto">
      <div className="px-4 py-3 text-xs font-mono text-[#cdd6f4] leading-relaxed">
        {children}
      </div>
    </pre>
  ),

  // Blockquotes — Obsidian callout style
  blockquote: ({ children }) => (
    <blockquote className="my-3 pl-4 border-l-4 border-primary/60 bg-primary/5 rounded-r-xl py-2 pr-3 text-sm text-foreground/80 italic">
      {children}
    </blockquote>
  ),

  // Unordered list
  ul: ({ children }) => (
    <ul className="list-disc list-outside pl-5 space-y-1 mb-3 text-sm text-foreground/90">
      {children}
    </ul>
  ),

  // Ordered list
  ol: ({ children }) => (
    <ol className="list-decimal list-outside pl-5 space-y-1 mb-3 text-sm text-foreground/90">
      {children}
    </ol>
  ),

  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

  // Horizontal rule
  hr: () => <hr className="my-4 border-border/40" />,

  // Strong / bold
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),

  // Em / italic
  em: ({ children }) => (
    <em className="italic text-foreground/80">{children}</em>
  ),

  // Links
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

  // Tables — Obsidian-style
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-border/50">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-primary/10 text-foreground font-semibold">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-border/30">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-primary/5 transition-colors">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-foreground/70 border-b border-border/50">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 text-foreground/85">{children}</td>
  ),
};

interface Props {
  content: string;
  isError?: boolean;
}

export default function ObsidianMarkdown({ content, isError }: Props) {
  const safeContent = content || "";
  const text = isError
    ? safeContent.replace("⚠️ Erro:", "").trim()
    : safeContent;

  return (
    <div className="obsidian-md min-w-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
