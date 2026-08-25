/** Renders agent output. Briefs and summaries are always markdown. */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/cn";

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-brief", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Sources open away from the app; never trust rel on model output.
          a: ({ href, children: linkChildren }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {linkChildren}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
