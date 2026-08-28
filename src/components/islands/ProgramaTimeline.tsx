import { useEffect, useState } from "react";
import Clock from "lucide-react/dist/esm/icons/clock";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Mic from "lucide-react/dist/esm/icons/mic";
import { getSupabase } from "@/lib/supabase/client";

type Item = {
  id: string;
  day_number: number;
  day_label: string;
  start_time: string;
  end_time: string | null;
  title: string;
  description: string | null;
  speaker: string | null;
  location: string | null;
};

export function ProgramaTimeline() {
  const [data, setData] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await (await getSupabase())
        .from("schedule_items")
        .select("*")
        .order("day_number")
        .order("sort_order");
      if (!active) return;
      if (!error && data) setData(data as Item[]);
      setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const days = Array.from(new Set(data.map((i) => i.day_number)));

  return (
    <main className="mx-auto max-w-4xl px-4 py-14">
      {isLoading && <p className="text-muted-foreground">Cargando programa…</p>}

      {days.map((day) => {
        const items = data.filter((i) => i.day_number === day);
        return (
          <section key={day} className="mb-14">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-5xl text-primary">
                {String(day).padStart(2, "0")}
              </span>
              <div>
                <h2 className="font-display text-xl">Día {day}</h2>
                <p className="text-sm text-muted-foreground">{items[0]?.day_label}</p>
              </div>
            </div>

            {/* Línea de tiempo vertical */}
            <ol className="relative mt-8 border-l-2 border-primary/30 pl-6">
              {items.map((item) => (
                <li key={item.id} className="relative pb-9 last:pb-0">
                  <span className="absolute -left-[31px] mt-1 flex size-4 items-center justify-center rounded-full border-2 border-primary bg-background">
                    <span className="size-1.5 rounded-full bg-accent" />
                  </span>
                  <div className="print-block bg-card p-5">
                    <p className="flex items-center gap-2 font-display text-sm text-primary">
                      <Clock className="size-4" />
                      {item.start_time}
                      {item.end_time ? ` — ${item.end_time}` : ""}
                    </p>
                    <h3 className="mt-2 text-lg normal-case">{item.title}</h3>
                    {item.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {item.speaker && (
                        <span className="flex items-center gap-1">
                          <Mic className="size-3.5" /> {item.speaker}
                        </span>
                      )}
                      {item.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3.5" /> {item.location}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </main>
  );
}
