import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { toast } from "sonner";
import { QrCode, ShieldCheck, CameraOff, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { checkinTicket, type AdminRegistrationRow } from "@/lib/api/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const [manualCode, setManualCode] = useState("");
  const [history, setHistory] = useState<ScanEntry[]>([]);

  const pushHistory = useCallback((ok: boolean, message: string) => {
    setHistory((prev) => [
      { id: crypto.randomUUID(), time: new Date().toLocaleTimeString("es-PE"), ok, message },
      ...prev,
    ].slice(0, 15));
  }, []);

  const runCheckin = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim().toUpperCase();
      if (!code) return;

      const last = lastCodeRef.current;
      if (last && last.code === code && Date.now() - last.at < RESCAN_COOLDOWN_MS) return;
      if (busyRef.current) return;

      busyRef.current = true;
      lastCodeRef.current = { code, at: Date.now() };
      try {
        const { registration } = await checkinTicket(code);
        const r: AdminRegistrationRow = registration;
        toast.success(`Ingreso válido — ${r.fullName}`);
        pushHistory(true, `${r.fullName} (${r.ticketCode})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "No pudimos validar el ingreso";
        toast.error(msg);
        pushHistory(false, `${code}: ${msg}`);
      } finally {
        busyRef.current = false;
      }
    },
    [pushHistory],
  );

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
      const code = jsQR(frame.data, frame.width, frame.height);
      if (code?.data) void runCheckin(code.data);
      rafRef.current = requestAnimationFrame(tick);
    };

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [isAdmin, runCheckin]);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    void runCheckin(manualCode);
    setManualCode("");
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
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="flex items-center gap-2 text-3xl font-semibold">
        <QrCode className="size-7" /> Escanear entrada
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Apunta la cámara al código QR de la entrada para validar el ingreso automáticamente.
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
        <Input
          value={manualCode}
          maxLength={20}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="O ingresa el código manualmente: SIN26-XXXX"
        />
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
    </main>
  );
}
