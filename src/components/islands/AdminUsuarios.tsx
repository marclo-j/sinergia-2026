import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Search, ShieldCheck, ChevronLeft, ChevronRight, QrCode, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchAdminRegistrations,
  fetchCheckinHistory,
  type AdminRegistrationRow,
  type CheckinLogRow,
} from "@/lib/api/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

const PAGE_SIZE = 10;

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }) : "—";

export function AdminUsuarios() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<AdminRegistrationRow[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [accessRow, setAccessRow] = useState<AdminRegistrationRow | null>(null);
  const [checkins, setCheckins] = useState<CheckinLogRow[]>([]);
  const [checkinsLoading, setCheckinsLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) window.location.href = "/auth";
  }, [loading, user]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { registrations } = await fetchAdminRegistrations();
      setRows(registrations);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos cargar los usuarios");
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.fullName, r.email, r.numeroDocumento, r.iglesia, r.ministerio]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedRows = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const openAccessDetail = async (row: AdminRegistrationRow) => {
    setAccessRow(row);
    setCheckins([]);
    setCheckinsLoading(true);
    try {
      const { checkins: history } = await fetchCheckinHistory(row.id);
      setCheckins(history);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos cargar el historial de acceso");
    } finally {
      setCheckinsLoading(false);
    }
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
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Usuarios</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Datos personales y ministeriales de cada persona registrada ({rows.length} en total).
      </p>

      <div className="relative mt-6 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, correo, documento, iglesia…"
          className="pl-9"
        />
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-245 text-sm">
          <thead className="text-left text-xs tracking-wider text-muted-foreground uppercase">
            <tr>
              <th className="p-2">Nombre</th>
              <th className="p-2">Documento</th>
              <th className="p-2">Contacto</th>
              <th className="p-2">Iglesia</th>
              <th className="p-2">Ministerio</th>
              <th className="p-2">Rol</th>
              <th className="p-2">Acceso</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-2">{r.fullName}</td>
                <td className="p-2 font-mono text-xs uppercase">
                  {r.tipoDocumento} {r.numeroDocumento}
                </td>
                <td className="p-2">
                  {r.email}
                  <span className="block text-xs text-muted-foreground">{r.phone}</span>
                </td>
                <td className="p-2">{r.iglesia ?? "—"}</td>
                <td className="p-2">{r.ministerio ?? "—"}</td>
                <td className="p-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      r.role === "admin" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.role}
                  </span>
                </td>
                <td className="p-2">
                  <Button variant="outline" size="sm" onClick={() => openAccessDetail(r)}>
                    <QrCode className="size-4" /> Detalle de acceso
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No hay usuarios que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Página {page} de {totalPages} · {filtered.length} usuarios
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

      <Dialog open={accessRow !== null} onClose={() => setAccessRow(null)} title="Detalle de acceso">
        {accessRow && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Estado del ingreso de <strong className="uppercase">{accessRow.fullName}</strong>.
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border p-3 text-sm">
              <dt className="text-muted-foreground">Código</dt>
              <dd className="font-mono text-xs">{accessRow.ticketCode}</dd>
              <dt className="text-muted-foreground">Estado de acceso</dt>
              <dd>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    accessRow.checkedInAt
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {accessRow.checkedInAt ? "Validado" : "Sin validar"}
                </span>
              </dd>
              <dt className="text-muted-foreground">Fecha y hora de validación</dt>
              <dd>{formatDate(accessRow.checkedInAt)}</dd>
            </dl>

            <div>
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Historial de validaciones
              </h3>
              {checkinsLoading ? (
                <p className="mt-2 text-sm text-muted-foreground">Cargando historial…</p>
              ) : checkins.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Todavía no hay intentos de validación registrados para esta entrada.
                </p>
              ) : (
                <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                  {checkins.map((c) => (
                    <li
                      key={c.id}
                      className={`flex items-start gap-2 rounded-md border p-2 text-sm ${
                        c.success ? "border-accent/40 bg-accent/10" : "border-destructive/40 bg-destructive/10"
                      }`}
                    >
                      {c.success ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                      ) : (
                        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      )}
                      <span className="flex-1">
                        {c.message ?? (c.success ? "Ingreso validado" : "Intento fallido")}
                        {c.scannedBy && (
                          <span className="block text-xs text-muted-foreground">Escaneado por {c.scannedBy}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setAccessRow(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </main>
  );
}
