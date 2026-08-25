import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { BadgeCheck, Clock3, PackageCheck, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Registration = {
  id: string;
  ticket_code: string;
  full_name: string;
  status: "pending" | "review" | "paid" | "rejected";
  materials_picked_up: boolean;
  materials_picked_up_at: string | null;
  checked_in_at: string | null;
};

const statusMap = {
  pending: { label: "Pago pendiente", icon: Clock3, tone: "bg-muted text-foreground" },
  review: { label: "Pago en revisión", icon: Clock3, tone: "bg-secondary text-foreground" },
  paid: { label: "Pago confirmado", icon: BadgeCheck, tone: "bg-accent text-accent-foreground" },
  rejected: { label: "Pago rechazado", icon: XCircle, tone: "bg-destructive text-destructive-foreground" },
} as const;

export function MiEntrada() {
  const { user, loading } = useAuth();
  const [reg, setReg] = useState<Registration | null>(null);
  const [qr, setQr] = useState<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loading && !user) window.location.href = "/auth";
  }, [loading, user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("registrations")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (data) {
        const r = data as unknown as Registration;
        setReg(r);
        const url = await QRCode.toDataURL(r.ticket_code, {
          width: 640,
          margin: 1,
          color: { dark: "#1b1512", light: "#ffffff" },
        });
        if (active) setQr(url);
      }
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const markMaterials = async () => {
    if (!reg) return;
    const { data, error } = await supabase
      .from("registrations")
      .update({ materials_picked_up: true, materials_picked_up_at: new Date().toISOString() })
      .eq("id", reg.id)
      .select("*")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setReg(data as unknown as Registration);
    toast.success("Marcamos tus materiales como recogidos");
  };

  const s = reg ? statusMap[reg.status] : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-4xl">Mi entrada</h1>

      {!ready && <p className="mt-6 text-muted-foreground">Cargando…</p>}

      {ready && !reg && (
        <div className="print-block mt-8 bg-card p-6">
          <p className="text-muted-foreground">Todavía no tienes una inscripción registrada.</p>
          <a
            href="/inscripcion"
            className="mt-4 inline-flex bg-primary px-5 py-3 font-display text-sm text-primary-foreground"
          >
            Inscribirme
          </a>
        </div>
      )}

      {ready && reg && s && (
        <div className="mt-8 grid gap-6 md:grid-cols-[auto_1fr]">
          <div className="print-block bg-card p-6 text-center">
            {qr ? (
              <img src={qr} alt={`Código QR de acceso ${reg.ticket_code}`} className="mx-auto w-56" />
            ) : (
              <div className="mx-auto size-56 animate-pulse bg-muted" />
            )}
            <p className="mt-4 font-display text-lg tracking-widest">{reg.ticket_code}</p>
            <p className="text-xs text-muted-foreground">Muestra este código en el ingreso</p>
          </div>

          <div className="space-y-4">
            <div className="print-block bg-card p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Asistente</p>
              <p className="font-display text-xl normal-case">{reg.full_name}</p>
            </div>

            <div className={`print-block p-5 ${s.tone}`}>
              <p className="flex items-center gap-2 font-display text-sm">
                <s.icon className="size-5" /> {s.label}
              </p>
            </div>

            <div className="print-block bg-card p-5">
              <p className="flex items-center gap-2 font-display text-sm">
                <PackageCheck className="size-5" /> Materiales del asistente
              </p>
              {reg.materials_picked_up ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Recogidos
                  {reg.materials_picked_up_at
                    ? ` el ${new Date(reg.materials_picked_up_at).toLocaleString("es-PE")}`
                    : ""}
                  .
                </p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Aún no recoges tu kit (cuaderno, lapicero, credencial y stickers).
                  </p>
                  <button
                    onClick={markMaterials}
                    className="mt-3 inline-flex bg-accent px-4 py-2 font-display text-sm text-accent-foreground"
                  >
                    Ya recogí mis materiales
                  </button>
                </>
              )}
            </div>

            {reg.checked_in_at && (
              <p className="text-sm text-muted-foreground">
                Ingreso validado el {new Date(reg.checked_in_at).toLocaleString("es-PE")}.
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
