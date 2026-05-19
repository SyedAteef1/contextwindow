import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00ff66]/50 focus-visible:border-[#00ff66]/50 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 font-sans",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
