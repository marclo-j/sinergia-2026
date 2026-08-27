import { useEffect, useState, useCallback, type ChangeEvent } from "react";
import { toast } from "sonner";
import { QrCode, ShieldCheck, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchAdminRegistrations,
  setRegistrationStatus,
  toggleRegistrationMaterials,
  checkinTicket,
  openReceipt,
  fetchSettings,
  updateSettings,
  uploadYapeQr,
  yapeQrUrl,
  type AdminRegistrationRow,
  type Settings,
} from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toDateInputValue(iso: string) {
  return iso.slice(0, 10);
}

function SettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pricePreventa, setPricePreventa] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [preventaHasta, setPreventaHasta] = useState("");
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrVersion, setQrVersion] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { settings } = await fetchSettings();
      setSettings(settings);
      setPricePreventa(String(settings.pricePreventa));
      setPrecioVenta(String(settings.precioVenta));
      setPreventaHasta(toDateInputValue(settings.preventaHasta));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos cargar la configuración");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const savePrices = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { settings } = await updateSettings({
        pricePreventa: Number(pricePreventa),
        precioVenta: Number(precioVenta),
        preventaHasta,
      });
      setSettings(settings);
      toast.success("Precios actualizados");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos actualizar los precios");
    } finally {
      setBusy(false);
    }
  };

  const saveQr = async () => {
    if (!qrFile) return;
    setBusy(true);
    try {
      const { settings } = await uploadYapeQr(qrFile);
      setSettings(settings);
      setQrFile(null);
      setQrVersion((v) => v + 1);
      toast.success("QR de Yape actualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos subir el QR");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="print-block mt-6 bg-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg">
        <SettingsIcon className="size-5" /> Precios y QR de Yape
      </h2>

      <form onSubmit={savePrices} className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="pricePreventa">Preventa (S/)</Label>
          <Input
            id="pricePreventa"
            type="number"
            min="0"
            step="0.01"
            value={pricePreventa}
            onChange={(e) => setPricePreventa(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="precioVenta">Venta (S/)</Label>
          <Input
            id="precioVenta"
            type="number"
            min="0"
            step="0.01"
            value={precioVenta}
            onChange={(e) => setPrecioVenta(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="preventaHasta">Preventa hasta</Label>
          <Input
            id="preventaHasta"
            type="date"
            value={preventaHasta}
            onChange={(e) => setPreventaHasta(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy} className="sm:col-span-3 sm:w-fit">
          Guardar precios
        </Button>
      </form>

      {settings && (
        <p className="mt-3 text-xs text-muted-foreground">
          Precio vigente ahora: <strong>{settings.currentPrice.label}</strong> — S/{" "}
          {settings.currentPrice.amount}.00
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex size-32 items-center justify-center border-2 border-dashed border-border bg-background">
          {settings?.hasYapeQr ? (
            <img
              key={qrVersion}
              src={`${yapeQrUrl()}?v=${qrVersion}`}
              alt="QR de Yape actual"
              className="size-full object-contain"
            />
          ) : (
            <QrCode className="size-8 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="qrFile">Reemplazar QR de Yape (imagen)</Label>
          <div className="flex gap-2">
            <Input
              id="qrFile"
              type="file"
              accept="image/*"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setQrFile(e.target.files?.[0] ?? null)}
            />
            <Button type="button" onClick={saveQr} disabled={busy || !qrFile}>
              Subir
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminPanel() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [code, setCode] = useState("");
  const [rows, setRows] = useState<AdminRegistrationRow[]>([]);

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

  if (loading) {
    return <p className="p-10 text-muted-foreground">Cargando…</p>;
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <ShieldCheck className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl">Acceso restringido</h1>
        <p className="mt-2 text-muted-foreground">Esta sección es solo para el equipo organizador.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-3xl">Panel del equipo</h1>

      <div className="print-block mt-6 bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg">
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

      <SettingsPanel />

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-left font-display text-xs uppercase tracking-wider text-muted-foreground">
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
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-pixel text-xs">{r.ticketCode}</td>
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
