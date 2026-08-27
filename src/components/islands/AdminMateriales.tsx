import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Search, ShieldCheck, ChevronLeft, ChevronRight, Package, RefreshCw } from "lucide-react";
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

      <Dialog
        open={confirmRow !== null}
        onClose={() => setConfirmRow(null)}
        title={confirmRow?.materialsPickedUp ? "Deshacer entrega de materiales" : "Confirmar entrega de materiales"}
      >
        {confirmRow && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {confirmRow.materialsPickedUp
                ? "¿Confirmas que quieres deshacer el registro de entrega de"
                : "¿Confirmas que quieres marcar como entregados los materiales de"}{" "}
              <strong className="uppercase">{confirmRow.fullName}</strong>?
            </p>
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
                Cancelar
              </Button>
              <Button
                variant={confirmRow.materialsPickedUp ? "outline" : "default"}
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
