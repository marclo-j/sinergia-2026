import type { ReactNode } from "react";

// Marco tipo ventana de PC antigua: barra de título en pixel font, LED
// parpadeante y tres "botones" cuadrados imitando _ □ X.
// Usar dentro de un contenedor `print-block`.
export function RetroWindow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="print-block">
      <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-electric px-3 py-2">
        <span className="flex items-center gap-2">
          <span className="cursor-blink size-2 rounded-full bg-ember" />
          <span className="font-pixel text-[10px] tracking-widest text-electric-foreground">{title}</span>
        </span>
        <span className="flex gap-1.5">
          <span className="size-2.5 border border-ink bg-ember" />
          <span className="size-2.5 border border-ink bg-ember" />
          <span className="size-2.5 border border-ink bg-primary" />
        </span>
      </div>
      <div className="bg-card">{children}</div>
    </div>
  );
}
