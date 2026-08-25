import { useEffect, useState } from "react";

const EVENT_START = new Date("2026-10-30T16:00:00-05:00");

function useCountdown() {
  const [left, setLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, EVENT_START.getTime() - Date.now());
      setLeft({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff / 3600000) % 24),
        m: Math.floor((diff / 60000) % 60),
        s: Math.floor((diff / 1000) % 60),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return left;
}

export function Countdown() {
  const t = useCountdown();

  return (
    <div className="flex flex-wrap gap-3">
      {[
        { v: t.d, l: "Días" },
        { v: t.h, l: "Horas" },
        { v: t.m, l: "Min" },
        { v: t.s, l: "Seg" },
      ].map((b) => (
        <div key={b.l} className="min-w-20 bg-ink/60 px-4 py-3 text-center">
          <p className="font-display text-3xl text-accent">{String(b.v).padStart(2, "0")}</p>
          <p className="text-xs tracking-[0.15em] uppercase">{b.l}</p>
        </div>
      ))}
    </div>
  );
}
