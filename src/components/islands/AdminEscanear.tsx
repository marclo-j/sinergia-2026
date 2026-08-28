import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { toast } from "sonner";
import { QrCode, ShieldCheck, CameraOff, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  checkinTicket,
  fetchAdminRegistrations,
  type AdminRegistrationRow,
  type RegistrationStatus,
} from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type ScanEntry = {
  id: string;
  time: string;
  ok: boolean;
  message: string;
};

// Tras un check-in (exitoso o no) esperamos este tiempo antes de aceptar el
// mismo código de nuevo, para no reenviar el mismo QR varias veces mientras
// sigue frente a la cámara.
const RESCAN_COOLDOWN_MS = 4000;

const TICKET_PREFIX = "SIN26-";

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }) : "—";

const statusLabel: Record<RegistrationStatus, string> = {
  pending: "Pago pendiente",
  review: "Pago en revisión",
  paid: "Pago confirmado",
  rejected: "Pago rechazado",
};

export function AdminEscanear() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const busyRef = useRef(false);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [history, setHistory] = useState<ScanEntry[]>([]);
  const [rows, setRows] = useState<AdminRegistrationRow[]>([]);
  const [pendingCheckin, setPendingCheckin] = useState<AdminRegistrationRow | null>(null);
  const [checkinBusy, setCheckinBusy] = useState(false);
  // Espejo de `rows` en un ref: así openConfirm no cambia de identidad cada vez
  // que la lista se actualiza, y no reinicia el efecto que maneja la cámara.
  const rowsRef = useRef<AdminRegistrationRow[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const pushHistory = useCallback((ok: boolean, message: string) => {
    setHistory((prev) => [
      { id: crypto.randomUUID(), time: new Date().toLocaleTimeString("es-PE"), ok, message },
      ...prev,
    ].slice(0, 15));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchAdminRegistrations()
      .then(({ registrations }) => setRows(registrations))
      .catch(() => {
        // silencioso: si falla, igual podemos validar directo contra el backend
      });
  }, [isAdmin]);

  const runCheckin = useCallback(
    async (ticket: string) => {
      setCheckinBusy(true);
      try {
        const { registration } = await checkinTicket(ticket);
        toast.success(`Ingreso válido — ${registration.fullName}`);
        pushHistory(true, `${registration.fullName} (${registration.ticketCode})`);
        setRows((prev) =>
          prev.map((r) => (r.id === registration.id ? { ...r, checkedInAt: registration.checkedInAt } : r)),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "No pudimos validar el ingreso";
        toast.error(msg);
        pushHistory(false, `${ticket}: ${msg}`);
      } finally {
        setCheckinBusy(false);
        busyRef.current = false;
        setPendingCheckin(null);
      }
    },
    [pushHistory],
  );

  // Punto de entrada único para cámara y código manual: si conocemos a la
  // persona la mostramos en un popup para confirmar antes de validar; si no,
  // validamos directo contra el backend.
  const openConfirm = useCallback(
    (rawCode: string) => {
      const ticket = rawCode.trim().toUpperCase();
      if (!ticket) return;

      const last = lastCodeRef.current;
      if (last && last.code === ticket && Date.now() - last.at < RESCAN_COOLDOWN_MS) return;
      if (busyRef.current) return;

      lastCodeRef.current = { code: ticket, at: Date.now() };
      busyRef.current = true;

      const match = rowsRef.current.find((r) => r.ticketCode.toUpperCase() === ticket);
      if (match) {
        setPendingCheckin(match);
      } else {
        void runCheckin(ticket);
      }
    },
    [runCheckin],
  );

  const confirmCheckin = () => {
    if (!pendingCheckin) return;
    void runCheckin(pendingCheckin.ticketCode);
  };

  const cancelCheckin = () => {
    setPendingCheckin(null);
    busyRef.current = false;
  };

  useEffect(() => {
    if (!loading && !user) window.location.href = "/auth";
  }, [loading, user]);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setScanning(true);
        tick();
      } catch (err) {
        setCameraError(
          err instanceof Error && err.name === "NotAllowedError"
            ? "Necesitamos permiso de cámara para leer el QR."
            : "No pudimos acceder a la cámara. Usa el código manual abajo.",
        );
      }
    };

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr = jsQR(frame.data, frame.width, frame.height);
      if (qr?.data) openConfirm(qr.data);
      rafRef.current = requestAnimationFrame(tick);
    };

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [isAdmin, openConfirm]);

  const handleCodeChange = (raw: string) => {
    const upper = raw.toUpperCase();
    setCode(upper.startsWith(TICKET_PREFIX) ? upper.slice(TICKET_PREFIX.length) : upper);
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const suffix = code.trim();
    if (!suffix) return;
    openConfirm(`${TICKET_PREFIX}${suffix}`);
    setCode("");
  };

  if (loading) {
    return <p className="p-10 text-muted-foreground">Cargando…</p>;
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <ShieldCheck className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">Acceso restringido</h1>
        <p className="mt-2 text-muted-foreground">Esta sección es solo para el equipo organizador.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="flex items-center gap-2 text-3xl font-semibold">
        <QrCode className="size-7" /> Escanear entrada
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Apunta la cámara al código QR de la entrada para revisar su ficha y validar el ingreso.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
        <div className="relative aspect-video bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          {scanning && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="size-56 max-w-[70%] rounded-lg border-4 border-accent/80" />
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card px-6 text-center">
              <CameraOff className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{cameraError}</p>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={submitManual} className="mt-4 flex gap-2">
        <div className="flex h-9 flex-1 items-center rounded-md border border-input bg-transparent px-3 shadow-sm focus-within:ring-1 focus-within:ring-ring">
          <span className="text-sm text-muted-foreground select-none">{TICKET_PREFIX}</span>
          <input
            value={code}
            maxLength={14}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="XXXX"
            className="h-full flex-1 border-0 bg-transparent text-base uppercase outline-none placeholder:text-muted-foreground md:text-sm"
          />
        </div>
        <Button type="submit">Validar</Button>
      </form>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Últimos escaneos</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Todavía no escaneas ninguna entrada.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {history.map((h) => (
              <li
                key={h.id}
                className={`flex items-center gap-2 rounded-md border p-2 text-sm ${
                  h.ok ? "border-accent/40 bg-accent/10" : "border-destructive/40 bg-destructive/10"
                }`}
              >
                {h.ok ? (
                  <CheckCircle2 className="size-4 shrink-0 text-accent" />
                ) : (
                  <XCircle className="size-4 shrink-0 text-destructive" />
                )}
                <span className="flex-1">{h.message}</span>
                <span className="text-xs text-muted-foreground">{h.time}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={pendingCheckin !== null} onClose={cancelCheckin} title="Confirmar validación de entrada">
        {pendingCheckin && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              ¿Confirmas el ingreso de <strong className="uppercase">{pendingCheckin.fullName}</strong>?
            </p>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-md border border-border p-3 text-sm sm:grid-cols-2">
              <dt className="text-muted-foreground">Código</dt>
              <dd className="font-mono text-xs">{pendingCheckin.ticketCode}</dd>
              <dt className="text-muted-foreground">Asistente</dt>
              <dd className="uppercase">{pendingCheckin.fullName}</dd>
              <dt className="text-muted-foreground">Correo</dt>
              <dd>{pendingCheckin.email}</dd>
              <dt className="text-muted-foreground">Teléfono</dt>
              <dd>{pendingCheckin.phone}</dd>
              <dt className="text-muted-foreground">Documento</dt>
              <dd className="uppercase">
                {pendingCheckin.tipoDocumento} {pendingCheckin.numeroDocumento}
              </dd>
              <dt className="text-muted-foreground">Estado</dt>
              <dd>{statusLabel[pendingCheckin.status]}</dd>
            </dl>
            {pendingCheckin.status !== "paid" && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                Esta inscripción no tiene el pago confirmado; el backend rechazará la validación.
              </p>
            )}
            {pendingCheckin.checkedInAt && (
              <p className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                Ya se validó antes, el {formatDate(pendingCheckin.checkedInAt)}.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={cancelCheckin} disabled={checkinBusy}>
                Cancelar
              </Button>
              <Button onClick={confirmCheckin} disabled={checkinBusy}>
                {checkinBusy ? "Validando…" : "VALIDAR INGRESO"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </main>
  );
}
