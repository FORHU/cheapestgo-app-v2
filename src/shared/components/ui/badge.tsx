import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 backdrop-blur-sm shadow-sm",
  {
    variants: {
      variant: {
        default: "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-500/15 dark:ring-blue-400/15",
        secondary: "bg-slate-100/80 text-slate-700 dark:bg-white/10 dark:text-slate-200 ring-1 ring-inset ring-slate-200/60 dark:ring-white/10",
        destructive: "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-inset ring-rose-500/15 dark:ring-rose-400/15",
        outline: "text-slate-600 dark:text-slate-400 ring-1 ring-inset ring-slate-200/80 dark:ring-white/10",
        success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/15 dark:ring-emerald-400/15",
        warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-500/15 dark:ring-amber-400/15",
        ghost: "bg-transparent shadow-none ring-0",
      },
      size: {
        default: "px-2.5 py-0.5 text-[10px] uppercase tracking-wider",
        sm: "px-2 py-0 text-[10px] uppercase tracking-wider",
        lg: "px-3 py-1 text-xs uppercase tracking-widest",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
  VariantProps<typeof badgeVariants> { }

function Badge({
  className,
  variant,
  size,
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
