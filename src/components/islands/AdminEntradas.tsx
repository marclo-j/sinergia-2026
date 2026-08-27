import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { QrCode, ShieldCheck, Check, X, Banknote, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchAdminRegistrations,
  setRegistrationStatus,
  checkinTicket,
  fetchReceipt,
  registerPhysicalPayment,
  fetchPaymentMethods,
  type AdminRegistrationRow,
  type RegistrationStatus,
  type PaymentMethodItem,
} from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";

const PAGE_SIZE = 10;

type ConfirmState = { type: "paid" | "rejected"; row: AdminRegistrationRow } | null;

const confirmCopy: Record<"paid" | "rejected", { title: string; question: string; confirmLabel: string }> = {
  paid: {
    title: "Aprobar el pago digital",
    question: "¿Confirmas que quieres aprobar el pago digital de",
    confirmLabel: "APROBAR COMO PAGO DIGITAL",
  },
  rejected: {
    title: "Rechazar inscripción",
    question: "¿Confirmas que quieres rechazar la inscripción de",
    confirmLabel: "RECHAZAR",
  },
};

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })
    : "—";

const statusLabel: Record<RegistrationStatus, string> = {
  pending: "Pendiente",
  review: "Pendiente",
  paid: "Aprobado",
  rejected: "Rechazado",
};

const statusBadgeClass: Record<RegistrationStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  review: "bg-muted text-muted-foreground",
  paid: "bg-accent text-accent-foreground",
  rejected: "bg-destructive text-destructive-foreground",
};

const statusRowClass: Record<RegistrationStatus, string> = {
  pending: "bg-muted/30",
  review: "bg-muted/30",
  paid: "bg-accent/10",
  rejected: "bg-destructive/10",
};

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
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [physicalPaymentRow, setPhysicalPaymentRow] = useState<AdminRegistrationRow | null>(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ row: AdminRegistrationRow; url: string; type: string } | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [manualMethod, setManualMethod] = useState("");
  const [manualReference, setManualReference] = useState("");

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

  useEffect(() => {
    if (!isAdmin) return;
    fetchPaymentMethods()
      .then(({ methods }) => setPaymentMethods(methods))
      .catch(() => {
        // silencioso: solo afecta el selector manual de método de pago
      });
  }, [isAdmin]);

  const handleReload = async () => {
    setReloading(true);
    try {
      await reload();
    } finally {
      setReloading(false);
    }
  };

  const setStatus = async (
    id: string,
    status: AdminRegistrationRow["status"],
    payment?: { paymentMethod?: string; paymentReference?: string },
  ) => {
    try {
      await setRegistrationStatus(id, status, payment);
      toast.success("Estado actualizado");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos actualizar el estado");
    }
  };

  // Si nunca llegó un pago por la plataforma (status "pending", sin paymentMethod), el
  // admin debe indicar manualmente por cuál medio se hizo antes de poder aprobar.
  const needsManualMethod = confirm?.type === "paid" && !confirm.row.paymentMethod;

  useEffect(() => {
    setManualMethod("");
    setManualReference("");
  }, [confirm]);

  const confirmStatusChange = async () => {
    if (!confirm) return;
    if (needsManualMethod && !manualMethod) {
      toast.error("Selecciona por cuál medio de pago se hizo");
      return;
    }
    setBusy(true);
    try {
      await setStatus(
        confirm.row.id,
        confirm.type,
        needsManualMethod ? { paymentMethod: manualMethod, paymentReference: manualReference.trim() || undefined } : undefined,
      );
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const openPhysicalPaymentDialog = (row: AdminRegistrationRow) => {
    setReference("");
    setPhysicalPaymentRow(row);
  };

  const confirmPhysicalPayment = async () => {
    if (!physicalPaymentRow) return;
    setBusy(true);
    try {
      await registerPhysicalPayment(physicalPaymentRow.id, reference.trim() || undefined);
      toast.success("Pago físico registrado");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos registrar el pago físico");
    } finally {
      setBusy(false);
      setPhysicalPaymentRow(null);
    }
  };

  const viewReceipt = async (row: AdminRegistrationRow) => {
    setReceiptLoading(true);
    try {
      const { url, type } = await fetchReceipt(row.id);
      setReceipt({ row, url, type });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos abrir el comprobante");
    } finally {
      setReceiptLoading(false);
    }
  };

  const closeReceipt = () => {
    if (receipt) URL.revokeObjectURL(receipt.url);
    setReceipt(null);
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

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = useMemo(
    () => filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredRows, page],
  );

  const changeFilter = (key: FilterKey) => {
    setFilter(key);
    setPage(1);
  };

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

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
        <h1 className="text-3xl font-semibold">Entradas</h1>
        <Button variant="outline" size="sm" onClick={handleReload} disabled={reloading}>
          <RefreshCw className={`size-4 ${reloading ? "animate-spin" : ""}`} />
          {reloading ? "Actualizando…" : "Recargar"}
        </Button>
      </div>
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
            onClick={() => changeFilter(t.key)}
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
            <tr className="divide-x divide-border">
              <th className="p-2">Código</th>
              <th className="p-2">Asistente</th>
              <th className="p-2">Pago</th>
              <th className="p-2">Fechas</th>
              <th className="p-2">Estado</th>
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
            {pagedRows.map((r) => (
              <tr key={r.id} className={`divide-x divide-border border-t border-border ${statusRowClass[r.status]}`}>
                <td className="p-2 font-mono text-xs">{r.ticketCode}</td>
                <td className="p-2">
                  <span className="uppercase">{r.fullName}</span>
                  <span className="block text-xs text-muted-foreground">{r.email}</span>
                  <span className="block text-xs text-muted-foreground">{r.phone}</span>
                  <span className="block text-xs text-muted-foreground uppercase">
                    {r.tipoDocumento} {r.numeroDocumento}
                  </span>
                </td>
                <td className="p-2">
                  {r.paymentMethod ?? "—"}
                  <span className="block text-xs text-muted-foreground">{r.paymentReference ?? ""}</span>
                  {r.hasReceipt && (
                    <button
                      className="text-xs underline disabled:opacity-50"
                      disabled={receiptLoading}
                      onClick={() => viewReceipt(r)}
                    >
                      Ver comprobante
                    </button>
                  )}
                </td>
                <td className="p-2">
                  <span className="block text-sm">Inscripción: {formatDate(r.createdAt)}</span>
                  {r.paymentSubmittedAt && (
                    <span className="block text-sm">Envío de pago: {formatDate(r.paymentSubmittedAt)}</span>
                  )}
                  {r.physicalPaymentApprovedAt ? (
                    <span className="block text-sm">
                      Aprobación de efectivo: {formatDate(r.physicalPaymentApprovedAt)}
                    </span>
                  ) : (
                    r.approvedAt && <span className="block text-sm">Aprobación: {formatDate(r.approvedAt)}</span>
                  )}
                </td>
                <td className="p-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadgeClass[r.status]}`}>
                    {statusLabel[r.status]}
                  </span>
                </td>
                <td className="p-2">
                  <div className="flex flex-col items-stretch gap-2">
                    {r.status !== "paid" && (
                      <button
                        className="flex items-center justify-center gap-1 bg-accent px-2 py-1 text-xs text-accent-foreground"
                        onClick={() => setConfirm({ type: "paid", row: r })}
                      >
                        <Check className="size-3.5" /> APROBAR COMO PAGO DIGITAL
                      </button>
                    )}
                    {r.status !== "paid" && (
                      <button
                        className="flex items-center justify-center gap-1 bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                        onClick={() => openPhysicalPaymentDialog(r)}
                      >
                        <Banknote className="size-3.5" /> APROBAR COMO PAGO FÍSICO
                      </button>
                    )}
                    <button
                      className="flex items-center justify-center gap-1 bg-destructive px-2 py-1 text-xs text-destructive-foreground"
                      onClick={() => setConfirm({ type: "rejected", row: r })}
                    >
                      <X className="size-3.5" /> RECHAZAR
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredRows.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Página {page} de {totalPages} · {filteredRows.length} inscripciones
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
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm ? confirmCopy[confirm.type].title : ""}
      >
        {confirm && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {confirmCopy[confirm.type].question} <strong className="uppercase">{confirm.row.fullName}</strong>?
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border p-3 text-sm">
              <dt className="text-muted-foreground">Asistente</dt>
              <dd className="uppercase">{confirm.row.fullName}</dd>
              <dt className="text-muted-foreground">Correo</dt>
              <dd>{confirm.row.email}</dd>
              <dt className="text-muted-foreground">Teléfono</dt>
              <dd>{confirm.row.phone}</dd>
              <dt className="text-muted-foreground">Documento</dt>
              <dd className="uppercase">
                {confirm.row.tipoDocumento} {confirm.row.numeroDocumento}
              </dd>
            </dl>
            {confirm.type === "paid" && !needsManualMethod && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border p-3 text-sm">
                <dt className="text-muted-foreground">Método de pago</dt>
                <dd>{confirm.row.paymentMethod}</dd>
                <dt className="text-muted-foreground">Observación</dt>
                <dd>{confirm.row.paymentReference ?? "—"}</dd>
                <dt className="text-muted-foreground">Comprobante</dt>
                <dd>{confirm.row.hasReceipt ? "Adjunto" : "No adjunto"}</dd>
                <dt className="text-muted-foreground">Fecha de inscripción</dt>
                <dd>{formatDate(confirm.row.createdAt)}</dd>
                <dt className="text-muted-foreground">Fecha de envío</dt>
                <dd>{formatDate(confirm.row.paymentSubmittedAt)}</dd>
              </dl>
            )}
            {needsManualMethod && (
              <div className="space-y-3 rounded-md border border-border p-3">
                <p className="text-sm text-muted-foreground">
                  Esta inscripción no registra un pago hecho por la plataforma. Indica por cuál medio se hizo para
                  poder aprobarla como pago digital.
                </p>
                <div className="space-y-2">
                  <label htmlFor="manual-method" className="text-sm font-medium">
                    Medio de pago
                  </label>
                  <select
                    id="manual-method"
                    value={manualMethod}
                    onChange={(e) => setManualMethod(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                  >
                    <option value="">Selecciona un medio…</option>
                    {paymentMethods.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="manual-reference" className="text-sm font-medium">
                    Observación (opcional)
                  </label>
                  <Input
                    id="manual-reference"
                    value={manualReference}
                    onChange={(e) => setManualReference(e.target.value)}
                    placeholder="Detalle u observación del pago"
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>
                Cancelar
              </Button>
              <Button
                variant={confirm.type === "rejected" ? "destructive" : "default"}
                onClick={confirmStatusChange}
                disabled={busy || (needsManualMethod && !manualMethod)}
              >
                {busy ? "Procesando…" : confirmCopy[confirm.type].confirmLabel}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={physicalPaymentRow !== null}
        onClose={() => setPhysicalPaymentRow(null)}
        title="Aprobar el pago físico"
      >
        {physicalPaymentRow && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              ¿Confirmas que quieres aprobar el pago físico de{" "}
              <strong className="uppercase">{physicalPaymentRow.fullName}</strong>?
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border p-3 text-sm">
              <dt className="text-muted-foreground">Asistente</dt>
              <dd className="uppercase">{physicalPaymentRow.fullName}</dd>
              <dt className="text-muted-foreground">Correo</dt>
              <dd>{physicalPaymentRow.email}</dd>
              <dt className="text-muted-foreground">Teléfono</dt>
              <dd>{physicalPaymentRow.phone}</dd>
              <dt className="text-muted-foreground">Documento</dt>
              <dd className="uppercase">
                {physicalPaymentRow.tipoDocumento} {physicalPaymentRow.numeroDocumento}
              </dd>
              <dt className="text-muted-foreground">Fecha de inscripción</dt>
              <dd>{formatDate(physicalPaymentRow.createdAt)}</dd>
            </dl>
            <div className="space-y-2">
              <label htmlFor="physical-reference" className="text-sm font-medium">
                Observación (opcional)
              </label>
              <Input
                id="physical-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Detalle u observación del pago"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPhysicalPaymentRow(null)} disabled={busy}>
                Cancelar
              </Button>
              <Button onClick={confirmPhysicalPayment} disabled={busy}>
                {busy ? "Procesando…" : "APROBAR COMO PAGO FÍSICO"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={receipt !== null} onClose={closeReceipt} title="Comprobante de pago">
        {receipt && (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border p-3 text-sm">
              <dt className="text-muted-foreground">Asistente</dt>
              <dd>{receipt.row.fullName}</dd>
              <dt className="text-muted-foreground">Correo</dt>
              <dd>{receipt.row.email}</dd>
              <dt className="text-muted-foreground">Teléfono</dt>
              <dd>{receipt.row.phone}</dd>
              <dt className="text-muted-foreground">Documento</dt>
              <dd className="uppercase">
                {receipt.row.tipoDocumento} {receipt.row.numeroDocumento}
              </dd>
              <dt className="text-muted-foreground">Método de pago</dt>
              <dd>{receipt.row.paymentMethod ?? "—"}</dd>
              <dt className="text-muted-foreground">Observación</dt>
              <dd>{receipt.row.paymentReference ?? "—"}</dd>
              <dt className="text-muted-foreground">Fecha de inscripción</dt>
              <dd>{formatDate(receipt.row.createdAt)}</dd>
              {receipt.row.paymentSubmittedAt && (
                <>
                  <dt className="text-muted-foreground">Fecha de envío</dt>
                  <dd>{formatDate(receipt.row.paymentSubmittedAt)}</dd>
                </>
              )}
              {receipt.row.approvedAt && (
                <>
                  <dt className="text-muted-foreground">
                    {receipt.row.physicalPaymentApprovedAt ? "Aprobación de efectivo" : "Fecha de aprobación"}
                  </dt>
                  <dd>{formatDate(receipt.row.approvedAt)}</dd>
                </>
              )}
            </dl>
            {receipt.type.startsWith("image/") ? (
              <img src={receipt.url} alt="Comprobante de pago" className="max-h-[70vh] w-full rounded-md object-contain" />
            ) : receipt.type === "application/pdf" ? (
              <iframe src={receipt.url} title="Comprobante de pago" className="h-[70vh] w-full rounded-md border border-border" />
            ) : (
              <a href={receipt.url} target="_blank" rel="noopener noreferrer" className="text-sm underline">
                Abrir comprobante en una pestaña nueva
              </a>
            )}
          </div>
        )}
      </Dialog>
    </main>
  );
}
