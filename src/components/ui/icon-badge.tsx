import type { LucideIcon } from "lucide-react";

export function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-electric text-electric-foreground">
      <Icon className="size-5" />
    </span>
  );
}
