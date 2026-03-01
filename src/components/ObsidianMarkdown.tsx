import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
    <div className="obsidian-md min-w-0 prose prose-sm dark:prose-invert max-w-none prose-p:mb-3 prose-p:leading-relaxed prose-headings:text-foreground prose-strong:text-foreground prose-li:text-foreground/90 prose-p:text-foreground/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
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
          p: ({ children }) => (
            <p className="text-sm leading-relaxed mb-3 last:mb-0 text-foreground/90">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground/80">{children}</em>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code className={`${className} text-[0.85em]`} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[0.8em] font-mono border border-primary/20">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-3 rounded-xl bg-[#1e1e2e] border border-border/40 overflow-x-auto px-4 py-3 text-xs font-mono text-[#cdd6f4] leading-relaxed">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 pl-4 border-l-4 border-primary/60 bg-primary/5 rounded-r-xl py-2 pr-3 text-sm text-foreground/80 italic">
              {children}
            </blockquote>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-5 space-y-1 mb-3 text-sm text-foreground/90">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-5 space-y-1 mb-3 text-sm text-foreground/90">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
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
          th: ({ children }) => (
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-foreground/70 border-b border-border/50">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2.5 text-foreground/85">{children}</td>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-primary/5 transition-colors border-b border-border/30 last:border-0">
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
