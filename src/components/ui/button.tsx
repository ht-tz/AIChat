"use client";

import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-cyber-cyan via-cyber-purple to-cyber-magenta text-white shadow-neon hover:shadow-neon-purple hover:scale-[1.02] active:scale-[0.98]",
        outline:
          "border border-cyber-border bg-cyber-surface/40 text-cyber-text hover:border-cyber-cyan hover:text-cyber-cyan hover:bg-cyber-surface/80",
        ghost: "text-cyber-text hover:bg-cyber-surface/60 hover:text-cyber-cyan",
        danger:
          "bg-cyber-danger/10 border border-cyber-danger/30 text-cyber-danger hover:bg-cyber-danger/20",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-6",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = "Button";
