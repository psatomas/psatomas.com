import type { ElementType, ReactNode } from "react";

export function Container({
  as: Tag = "div",
  children,
  className = "",
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag className={`mx-auto w-full max-w-3xl px-6 ${className}`}>
      {children}
    </Tag>
  );
}
