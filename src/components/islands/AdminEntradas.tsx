import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { QrCode, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchAdminRegistrations,
  setRegistrationStatus,
  toggleRegistrationMaterials,
  checkinTicket,
  openReceipt,
  type AdminRegistrationRow,
} from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FilterKey = "pendientes" | "aceptadas" | "rechazadas" | "todas";

const matchesFilter = (status: AdminRegistrationRow["status"], filter: FilterKey) => {
  if (filter === "todas") return true;
  if (filter === "pendientes") return status === "pending" || status === "review";
  if (filter === "aceptadas") return status === "paid";
  return status === "rejected";
};

export function AdminEntradas() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [code, setCode] = useState("");
  const [rows, setRows] = useState<AdminRegistrationRow[]>([]);
  const [filter, setFilter] = useState<FilterKey>("pendientes");

  useEffect(() => {
    if (!loading && !user) window.location.href = "/auth";
  }, [loading, user]);

  const reload = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { registrations } = await fetchAdminRegistrations();
      setRows(registrations);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos cargar las inscripciones");
    }
  }, [isAdmin]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setStatus = async (id: string, status: AdminRegistrationRow["status"]) => {
    try {
      await setRegistrationStatus(id, status);
      toast.success("Estado actualizado");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos actualizar el estado");
    }
  };

  const toggleMaterials = async (row: AdminRegistrationRow) => {
    try {
      await toggleRegistrationMaterials(row.id);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos actualizar los materiales");
    }
  };

  const validate = async () => {
    const ticket = code.trim().toUpperCase();
    if (!ticket) return;
    try {
      const { registration } = await checkinTicket(ticket);
      toast.success(`Ingreso válido — ${registration.fullName}`);
      setCode("");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos validar el ingreso");
    }
  };

  const tabs = useMemo(
    () =>
      (["pendientes", "aceptadas", "rechazadas", "todas"] as const).map((key) => ({
        key,
        label: key === "pendientes" ? "Pendientes" : key === "aceptadas" ? "Aceptadas" : key === "rechazadas" ? "Rechazadas" : "Todas",
        count: rows.filter((r) => matchesFilter(r.status, key)).length,
      })),
    [rows],
  );

  const filteredRows = useMemo(() => rows.filter((r) => matchesFilter(r.status, filter)), [rows, filter]);

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
      <h1 className="text-3xl font-semibold">Entradas</h1>
      <p className="mt-1 text-sm text-muted-foreground">Valida ingresos y revisa el estado de pago de cada inscripción.</p>

      <div className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <QrCode className="size-5" /> Validar entrada
        </h2>
        <div className="mt-3 flex gap-2">
          <Input
            value={code}
            maxLength={20}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SIN26-XXXXXX"
            onKeyDown={(e) => e.key === "Enter" && validate()}
          />
          <Button onClick={validate}>Validar</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Escanea el QR con cualquier lector; pega el código aquí y presiona Validar.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
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

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-205 text-sm">
          <thead className="text-left text-xs tracking-wider text-muted-foreground uppercase">
            <tr>
              <th className="p-2">Código</th>
              <th className="p-2">Asistente</th>
              <th className="p-2">Pago</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Materiales</th>
              <th className="p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No hay inscripciones en esta categoría.
                </td>
              </tr>
            )}
            {filteredRows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-2 font-mono text-xs">{r.ticketCode}</td>
                <td className="p-2">
                  {r.fullName}
                  <span className="block text-xs text-muted-foreground">{r.email}</span>
                </td>
                <td className="p-2">
                  {r.paymentMethod ?? "—"}
                  <span className="block text-xs text-muted-foreground">{r.paymentReference ?? ""}</span>
                  {r.hasReceipt && (
                    <button className="text-xs underline" onClick={() => openReceipt(r.id)}>
                      Ver comprobante
                    </button>
                  )}
                </td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">
                  <button className="text-xs underline" onClick={() => toggleMaterials(r)}>
                    {r.materialsPickedUp ? "Recogidos" : "Pendiente"}
                  </button>
                </td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button
                      className="bg-accent px-2 py-1 text-xs text-accent-foreground"
                      onClick={() => setStatus(r.id, "paid")}
                    >
                      Aprobar
                    </button>
                    <button
                      className="bg-destructive px-2 py-1 text-xs text-destructive-foreground"
                      onClick={() => setStatus(r.id, "rejected")}
                    >
                      Rechazar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
