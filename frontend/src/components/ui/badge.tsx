import * as React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "warning";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "border-transparent bg-primary text-primary-foreground",
    secondary: "border-transparent bg-muted text-muted-foreground",
    destructive:
      "border-transparent bg-destructive text-destructive-foreground",
    outline: "border-border text-foreground bg-transparent",
    warning: "border-transparent bg-amber-500/20 text-amber-400",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
