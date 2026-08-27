import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { BadgeCheck, Clock3, PackageCheck, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { markMaterialsPickedUp, type RegistrationStatus } from "@/lib/api/client";

const statusMap: Record<
  RegistrationStatus,
  { label: string; icon: typeof BadgeCheck; tone: string }
> = {
  pending: { label: "Pago pendiente", icon: Clock3, tone: "bg-muted text-foreground" },
  review: { label: "Pago en revisión", icon: Clock3, tone: "bg-secondary text-foreground" },
  paid: { label: "Pago confirmado", icon: BadgeCheck, tone: "bg-accent text-accent-foreground" },
  rejected: { label: "Pago rechazado", icon: XCircle, tone: "bg-destructive text-destructive-foreground" },
};

export function MiEntrada() {
  const { user, registration, loading, refresh } = useAuth();
  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) window.location.href = "/auth";
  }, [loading, user]);

  useEffect(() => {
    if (!registration) return;
    let active = true;
    QRCode.toDataURL(registration.ticketCode, {
      width: 640,
      margin: 1,
      color: { dark: "#1b1512", light: "#ffffff" },
    }).then((url) => {
      if (active) setQr(url);
    });
    return () => {
      active = false;
    };
  }, [registration]);

  const markMaterials = async () => {
    try {
      await markMaterialsPickedUp();
      await refresh();
      toast.success("Marcamos tus materiales como recogidos");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos actualizar tus materiales");
    }
  };

  const s = registration ? statusMap[registration.status] : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-pixel text-2xl tracking-widest uppercase">Mi entrada</h1>

      {loading && <p className="mt-6 text-muted-foreground">Cargando…</p>}

      {!loading && user && !registration && (
        <div className="print-block mt-8 bg-card p-6">
          <p className="text-muted-foreground">Todavía no tienes una inscripción registrada.</p>
          <a
            href="/inscripcion"
            className="mt-4 inline-flex bg-primary px-5 py-3 font-pixel text-xs tracking-widest text-primary-foreground uppercase"
          >
            Inscribirme
          </a>
        </div>
      )}

      {registration && s && user && (
        <div className="mt-8 grid gap-6 md:grid-cols-[auto_1fr]">
          <div className="print-block bg-card p-6 text-center">
            {qr ? (
              <img
                src={qr}
                alt={`Código QR de acceso ${registration.ticketCode}`}
                className="mx-auto w-56"
              />
            ) : (
              <div className="mx-auto size-56 animate-pulse bg-muted" />
            )}
            <p className="mt-4 font-pixel text-lg tracking-widest">{registration.ticketCode}</p>
            <p className="text-xs text-muted-foreground">Muestra este código en el ingreso</p>
          </div>

          <div className="space-y-4">
            <div className="print-block bg-card p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Asistente</p>
              <p className="font-pixel text-base tracking-widest uppercase">
                {user.nombres} {user.apellidos}
              </p>
            </div>

            <div className={`print-block p-5 ${s.tone}`}>
              <p className="flex items-center gap-2 font-pixel text-xs tracking-widest uppercase">
                <s.icon className="size-5" /> {s.label}
              </p>
            </div>

            <div className="print-block bg-card p-5">
              <p className="flex items-center gap-2 font-pixel text-xs tracking-widest uppercase">
                <PackageCheck className="size-5" /> Materiales del asistente
              </p>
              {registration.materialsPickedUp ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Recogidos
                  {registration.materialsPickedUpAt
                    ? ` el ${new Date(registration.materialsPickedUpAt).toLocaleString("es-PE")}`
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
                    className="mt-3 inline-flex bg-accent px-4 py-2 font-pixel text-xs tracking-widest text-accent-foreground uppercase"
                  >
                    Ya recogí mis materiales
                  </button>
                </>
              )}
            </div>

            {registration.checkedInAt && (
              <p className="text-sm text-muted-foreground">
                Ingreso validado el {new Date(registration.checkedInAt).toLocaleString("es-PE")}.
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
