import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * PageContainer: desktop width frame for a page's content. Below lg it adds NOTHING (mobile unchanged).
 *   <PageContainer>                 // default: fills the shell frame (max-w-6xl)
 *   <PageContainer size="narrow">   // forms / settings: lg:max-w-2xl, centered
 *   <PageContainer size="medium">   // lists: lg:max-w-4xl, centered
 * AppShell already supplies the outer lg frame (max-w-6xl, 24px padding; /admin is full width), so use this only
 * to NARROW a page. Keep the existing `mx-4` gutters inside; they still apply on desktop.
 * `as` changes the element (default div).
 */
const SIZES = {
  default: "",
  medium: "lg:mx-auto lg:max-w-4xl",
  narrow: "lg:mx-auto lg:max-w-2xl",
} as const;

interface PageContainerProps {
  size?: keyof typeof SIZES;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

export function PageContainer({ size = "default", as: Tag = "div", className, children }: PageContainerProps) {
  return <Tag className={cn("w-full", SIZES[size], className)}>{children}</Tag>;
}
