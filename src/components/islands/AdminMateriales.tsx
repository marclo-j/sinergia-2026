import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import jsQR from "jsqr";
import {
  Search,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Package,
  RefreshCw,
  QrCode,
  CameraOff,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchAdminRegistrations,
  toggleRegistrationMaterials,
  type AdminRegistrationRow,
} from "@/lib/api/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

const PAGE_SIZE = 10;

type FilterKey = "pendientes" | "entregados" | "todos";

const TICKET_PREFIX = "SIN26-";

// Tras un escaneo esperamos este tiempo antes de aceptar el mismo código de
// nuevo, para no reabrir el popup varias veces mientras sigue frente a la cámara.
const RESCAN_COOLDOWN_MS = 4000;

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }) : "—";

export function AdminMateriales() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<AdminRegistrationRow[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("pendientes");
  const [page, setPage] = useState(1);
  const [reloading, setReloading] = useState(false);
  const [confirmRow, setConfirmRow] = useState<AdminRegistrationRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookupCode, setLookupCode] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
  // Espejos en ref de `rows` y `confirmRow`: así findAndOpen tiene una identidad
  // estable y el efecto de la cámara no se reinicia en cada cambio de estado.
  const rowsRef = useRef<AdminRegistrationRow[]>([]);
  const confirmRowRef = useRef<AdminRegistrationRow | null>(null);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    confirmRowRef.current = confirmRow;
  }, [confirmRow]);

  useEffect(() => {
    if (!loading && !user) window.location.href = "/auth";
  }, [loading, user]);

  const reload = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { registrations } = await fetchAdminRegistrations();
      setRows(registrations.filter((r) => r.status === "paid"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos cargar los asistentes");
    }
  }, [isAdmin]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleReload = async () => {
    setReloading(true);
    try {
      await reload();
    } finally {
      setReloading(false);
    }
  };

  // Punto de entrada único para el buscador manual y la cámara: busca el
  // código entre los asistentes con pago aprobado y abre directo el popup de
  // confirmación de entrega (el mismo que usa la tabla).
  const findAndOpen = useCallback((rawCode: string) => {
    const ticket = rawCode.trim().toUpperCase();
    if (!ticket) return;
    if (confirmRowRef.current) return; // ya hay un popup abierto

    const last = lastCodeRef.current;
    if (last && last.code === ticket && Date.now() - last.at < RESCAN_COOLDOWN_MS) return;
    lastCodeRef.current = { code: ticket, at: Date.now() };

    const match = rowsRef.current.find((r) => r.ticketCode.toUpperCase() === ticket);
    if (match) {
      setCameraOpen(false);
      setConfirmRow(match);
    } else {
      toast.error(`No encontramos una entrada con pago aprobado para ${ticket}`);
    }
  }, []);

  const handleLookupChange = (raw: string) => {
    const upper = raw.toUpperCase();
    setLookupCode(upper.startsWith(TICKET_PREFIX) ? upper.slice(TICKET_PREFIX.length) : upper);
  };

  const submitLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const suffix = lookupCode.trim();
    if (!suffix) return;
    findAndOpen(`${TICKET_PREFIX}${suffix}`);
    setLookupCode("");
  };

  useEffect(() => {
    if (!cameraOpen) {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setScanning(false);
      return;
    }

    let cancelled = false;
    setCameraError(null);

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
            : "No pudimos acceder a la cámara.",
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
      if (qr?.data) findAndOpen(qr.data);
      rafRef.current = requestAnimationFrame(tick);
    };

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraOpen, findAndOpen]);

  const confirmToggle = async () => {
    if (!confirmRow) return;
    setBusy(true);
    try {
      await toggleRegistrationMaterials(confirmRow.id);
      toast.success(confirmRow.materialsPickedUp ? "Entrega deshecha" : "Materiales entregados");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos actualizar los materiales");
    } finally {
      setBusy(false);
      setConfirmRow(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows;
    if (filter === "pendientes") list = list.filter((r) => !r.materialsPickedUp);
    if (filter === "entregados") list = list.filter((r) => r.materialsPickedUp);
    if (!q) return list;
    return list.filter((r) =>
      [r.fullName, r.email, r.numeroDocumento, r.ticketCode].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [rows, query, filter]);

  useEffect(() => {
    setPage(1);
  }, [query, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedRows = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const tabs = useMemo(
    () =>
      (["pendientes", "entregados", "todos"] as const).map((key) => ({
        key,
        label: key === "pendientes" ? "Pendientes" : key === "entregados" ? "Entregados" : "Todos",
        count:
          key === "todos"
            ? rows.length
            : rows.filter((r) => (key === "entregados" ? r.materialsPickedUp : !r.materialsPickedUp)).length,
      })),
    [rows],
  );

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
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 text-3xl font-semibold">
          <Package className="size-7" /> Recojo de materiales
        </h1>
        <Button variant="outline" size="sm" onClick={handleReload} disabled={reloading}>
          <RefreshCw className={`size-4 ${reloading ? "animate-spin" : ""}`} />
          {reloading ? "Actualizando…" : "Recargar"}
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Registra la entrega de materiales de cada asistente con pago aprobado ({rows.length} en total).
      </p>

      <div className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <QrCode className="size-5" /> Buscar entrada
          </h2>
          <Button variant="outline" size="sm" onClick={() => setCameraOpen(true)}>
            Escanear QR
          </Button>
        </div>

        <form onSubmit={submitLookup} className="mt-3 flex gap-2">
          <div className="flex h-9 flex-1 items-center rounded-md border border-input bg-transparent px-3 shadow-sm focus-within:ring-1 focus-within:ring-ring">
            <span className="text-sm text-muted-foreground select-none">{TICKET_PREFIX}</span>
            <input
              value={lookupCode}
              maxLength={14}
              onChange={(e) => handleLookupChange(e.target.value)}
              placeholder="XXXX"
              className="h-full flex-1 border-0 bg-transparent text-base uppercase outline-none placeholder:text-muted-foreground md:text-sm"
            />
          </div>
          <Button type="submit">Buscar</Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Escanea el QR de la entrada o escribe el código para abrir directo la confirmación de entrega.
        </p>
      </div>

      <div className="relative mt-6 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, correo, documento, código…"
          className="pl-9"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              filter === t.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label} <span className="opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-215 text-sm">
          <thead className="text-left text-xs tracking-wider text-muted-foreground uppercase">
            <tr className="divide-x divide-border">
              <th className="p-2">Código</th>
              <th className="p-2">Asistente</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Fecha y hora de entrega</th>
              <th className="p-2">Entregado por</th>
              <th className="p-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((r) => (
              <tr
                key={r.id}
                className={`divide-x divide-border border-t border-border ${
                  r.materialsPickedUp ? "bg-accent/10" : "bg-muted/30"
                }`}
              >
                <td className="p-2 font-mono text-xs">{r.ticketCode}</td>
                <td className="p-2">
                  <span className="uppercase">{r.fullName}</span>
                  <span className="block text-xs text-muted-foreground">{r.email}</span>
                  <span className="block text-xs text-muted-foreground">{r.phone}</span>
                </td>
                <td className="p-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      r.materialsPickedUp ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.materialsPickedUp ? "Entregado" : "Pendiente"}
                  </span>
                </td>
                <td className="p-2 text-sm">{r.materialsPickedUp ? formatDate(r.materialsPickedUpAt) : "—"}</td>
                <td className="p-2 text-sm">{r.materialsDeliveredBy ?? "—"}</td>
                <td className="p-2">
                  <button
                    className={`px-2 py-1 text-xs ${
                      r.materialsPickedUp
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-accent text-accent-foreground"
                    }`}
                    onClick={() => setConfirmRow(r)}
                  >
                    {r.materialsPickedUp ? "Deshacer entrega" : "Marcar entregado"}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No hay asistentes que coincidan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Página {page} de {totalPages} · {filtered.length} asistentes
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 disabled:opacity-40"
            >
              <ChevronLeft className="size-4" /> Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 disabled:opacity-40"
            >
              Siguiente <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      <Dialog open={cameraOpen} onClose={() => setCameraOpen(false)} title="Escanear entrada">
        <div className="overflow-hidden rounded-lg border border-border bg-black">
          <div className="relative aspect-video">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />
            {scanning && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="size-40 max-w-[70%] rounded-lg border-4 border-accent/80" />
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
        <p className="mt-3 text-xs text-muted-foreground">
          Apunta la cámara al QR de la entrada; al detectarlo se abre la ficha del asistente.
        </p>
      </Dialog>

      <Dialog
        open={confirmRow !== null}
        onClose={() => setConfirmRow(null)}
        title={confirmRow?.materialsPickedUp ? "Ya está entregado" : "Confirmar entrega de materiales"}
        tone={confirmRow?.materialsPickedUp ? "success" : "default"}
      >
        {confirmRow && (
          <div className="space-y-4">
            {confirmRow.materialsPickedUp ? (
              <div className="flex items-center gap-3 rounded-md border border-green-300 bg-green-100 p-3 text-green-900 dark:border-green-700 dark:bg-green-900/40 dark:text-green-100">
                <CheckCircle2 className="size-6 shrink-0" />
                <p className="text-sm font-medium">
                  <span className="uppercase">{confirmRow.fullName}</span> ya recogió sus materiales.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                ¿Confirmas que quieres marcar como entregados los materiales de{" "}
                <strong className="uppercase">{confirmRow.fullName}</strong>?
              </p>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border p-3 text-sm">
              <dt className="text-muted-foreground">Código</dt>
              <dd className="font-mono text-xs">{confirmRow.ticketCode}</dd>
              <dt className="text-muted-foreground">Correo</dt>
              <dd>{confirmRow.email}</dd>
              <dt className="text-muted-foreground">Teléfono</dt>
              <dd>{confirmRow.phone}</dd>
              {!confirmRow.materialsPickedUp && (
                <>
                  <dt className="text-muted-foreground">Entregado por</dt>
                  <dd>{user?.nombres} {user?.apellidos}</dd>
                  <dt className="text-muted-foreground">Fecha y hora</dt>
                  <dd>{formatDate(new Date().toISOString())}</dd>
                </>
              )}
              {confirmRow.materialsPickedUp && (
                <>
                  <dt className="text-muted-foreground">Entregado por</dt>
                  <dd>{confirmRow.materialsDeliveredBy ?? "—"}</dd>
                  <dt className="text-muted-foreground">Fecha y hora</dt>
                  <dd>{formatDate(confirmRow.materialsPickedUpAt)}</dd>
                </>
              )}
            </dl>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmRow(null)} disabled={busy}>
                {confirmRow.materialsPickedUp ? "Cerrar" : "Cancelar"}
              </Button>
              <Button
                variant={confirmRow.materialsPickedUp ? "destructive" : "default"}
                className={confirmRow.materialsPickedUp ? "" : "bg-green-600 text-white shadow hover:bg-green-700"}
                onClick={confirmToggle}
                disabled={busy}
              >
                {busy ? "Procesando…" : confirmRow.materialsPickedUp ? "DESHACER ENTREGA" : "CONFIRMAR ENTREGA"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </main>
  );
}
