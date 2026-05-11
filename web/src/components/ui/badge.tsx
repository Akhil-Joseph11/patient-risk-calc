import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase",
  {
    variants: {
      variant: {
        default: "border-white/10 bg-white/5 text-slate-200",
        high: "border-red-400/30 bg-red-500/15 text-red-200 shadow-[0_0_20px_-6px_rgba(248,113,113,0.55)]",
        medium:
          "border-amber-400/35 bg-amber-500/15 text-amber-100 shadow-[0_0_18px_-8px_rgba(251,191,36,0.45)]",
        low: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100 shadow-[0_0_18px_-8px_rgba(52,211,153,0.35)]",
        reviewHigh:
          "border-emerald-400/35 bg-emerald-500/12 text-emerald-100 normal-case tracking-normal shadow-none",
        reviewMedium:
          "border-amber-400/40 bg-amber-500/12 text-amber-100 normal-case tracking-normal shadow-none",
        reviewNeed:
          "border-violet-400/40 bg-violet-500/15 text-violet-100 normal-case tracking-normal shadow-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
