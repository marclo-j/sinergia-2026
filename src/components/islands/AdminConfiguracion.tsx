import { useEffect, useState, useCallback, type ChangeEvent } from "react";
import { toast } from "sonner";
import { QrCode, ShieldCheck, Settings as SettingsIcon, Church, Users, Trash2, Wallet, Pencil, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchSettings,
  updateSettings,
  fetchCatalog,
  createCatalogItem,
  deleteCatalogItem,
  fetchPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  paymentMethodQrUrl,
  type Settings,
  type CatalogType,
  type CatalogItem,
  type PaymentMethodItem,
} from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";

function toDateInputValue(iso: string) {
  return iso.slice(0, 10);
}

function PreciosPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pricePreventa, setPricePreventa] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [preventaHasta, setPreventaHasta] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { settings } = await fetchSettings();
      setSettings(settings);
      setPricePreventa(String(settings.pricePreventa));
      setPrecioVenta(String(settings.precioVenta));
      setPreventaHasta(toDateInputValue(settings.preventaHasta));
      setWhatsapp(settings.whatsapp);
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
        whatsapp: whatsapp.trim(),
      });
      setSettings(settings);
      toast.success("Configuración actualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos actualizar la configuración");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-medium">
        <SettingsIcon className="size-5" /> Precios y contacto
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
        <div className="space-y-2 sm:col-span-3">
          <Label htmlFor="whatsapp">WhatsApp de contacto</Label>
          <Input
            id="whatsapp"
            type="tel"
            placeholder="Ej. 51987654321 (con código de país, sin +)"
            maxLength={20}
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Se muestra a quien está esperando la validación de su pago, como enlace directo al chat.
          </p>
        </div>
        <Button type="submit" disabled={busy} className="sm:col-span-3 sm:w-fit">
          Guardar
        </Button>
      </form>

      {settings && (
        <p className="mt-3 text-xs text-muted-foreground">
          Precio vigente ahora: <strong>{settings.currentPrice.label}</strong> — S/{" "}
          {settings.currentPrice.amount}.00
        </p>
      )}
    </div>
  );
}

function CatalogList({ type, label, icon: Icon }: { type: CatalogType; label: string; icon: typeof Church }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { items } = await fetchCatalog(type);
      setItems(items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `No pudimos cargar ${label.toLowerCase()}`);
    }
  }, [type, label]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      await createCatalogItem(type, name.trim());
      setName("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos agregarlo");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: CatalogItem) => {
    try {
      await deleteCatalogItem(type, item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos quitarlo");
    }
  };

  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4" /> {label}
      </h3>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <Input
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Agregar ${label.toLowerCase()}…`}
        />
        <Button type="submit" size="sm" disabled={busy}>
          Agregar
        </Button>
      </form>
      <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto">
        {items.length === 0 && (
          <li className="text-xs text-muted-foreground">Todavía no hay ninguna en la lista.</li>
        )}
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 border-b border-border py-1 text-sm">
            <span>{item.name}</span>
            <button
              type="button"
              onClick={() => remove(item)}
              aria-label={`Quitar ${item.name}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CatalogPanel() {
  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-medium">
        <Church className="size-5" /> Iglesias y ministerios
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Estas listas alimentan los selectores de "Iglesia" y "Ministerio" del formulario de inscripción.
      </p>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <CatalogList type="iglesias" label="Iglesias" icon={Church} />
        <CatalogList type="ministerios" label="Ministerios" icon={Users} />
      </div>
    </div>
  );
}

function PaymentMethodDialog({
  open,
  onClose,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: PaymentMethodItem | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setInstructions(editing?.instructions ?? "");
    setFile(null);
  }, [open, editing]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const existingQrUrl = editing?.hasQr ? paymentMethodQrUrl(editing.id) : null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      const input = { name: name.trim(), instructions: instructions.trim() || undefined, qrFile: file };
      if (editing) {
        await updatePaymentMethod(editing.id, input);
        toast.success("Método de pago actualizado");
      } else {
        await createPaymentMethod(input);
        toast.success("Método de pago agregado");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos guardar el método de pago");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={editing ? "Editar método de pago" : "Agregar método de pago"}>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pm-name">Nombre</Label>
          <Input
            id="pm-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Yape"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pm-instructions">Instrucciones (opcional)</Label>
          <Textarea
            id="pm-instructions"
            value={instructions}
            maxLength={500}
            rows={3}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Número, cuenta, banco…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pm-qr">Código QR (opcional)</Label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex size-16 shrink-0 items-center justify-center border-2 border-dashed border-border bg-background">
              {preview ? (
                <img src={preview} alt="Vista previa del QR" className="size-full object-contain" />
              ) : existingQrUrl ? (
                <img src={existingQrUrl} alt={`QR de ${editing?.name}`} className="size-full object-contain" />
              ) : (
                <QrCode className="size-6 text-muted-foreground" />
              )}
            </div>
            <Input
              id="pm-qr"
              type="file"
              accept="image/*"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)}
              className="max-w-52"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {editing ? "Guardar cambios" : "Agregar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function PaymentMethodsPanel() {
  const [methods, setMethods] = useState<PaymentMethodItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethodItem | null>(null);

  const load = useCallback(async () => {
    try {
      const { methods } = await fetchPaymentMethods();
      setMethods(methods);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos cargar los métodos de pago");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (m: PaymentMethodItem) => {
    setEditing(m);
    setDialogOpen(true);
  };

  const remove = async (item: PaymentMethodItem) => {
    try {
      await deletePaymentMethod(item.id);
      setMethods((prev) => prev.filter((m) => m.id !== item.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos quitarlo");
    }
  };

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <Wallet className="size-5" /> Métodos de pago digitales
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Solo aparecen aquí los métodos que agregues (ej. Yape, Plin) — cada uno con su propio QR.
            El pago en persona (efectivo) no se configura acá: se registra directo desde "Entradas"
            cuando alguien ya inscrito te paga físicamente.
          </p>
        </div>
        <Button type="button" size="sm" onClick={openCreate} className="shrink-0">
          <Plus className="size-4" /> Agregar método
        </Button>
      </div>

      <ul className="mt-4 space-y-3">
        {methods.length === 0 && (
          <li className="text-xs text-muted-foreground">Todavía no hay ningún método configurado.</li>
        )}
        {methods.map((m) => (
          <li key={m.id} className="flex items-start gap-3 border-b border-border pb-3 text-sm">
            <div className="flex size-12 shrink-0 items-center justify-center border-2 border-dashed border-border bg-background">
              {m.hasQr ? (
                <img src={paymentMethodQrUrl(m.id)} alt={`QR de ${m.name}`} className="size-full object-contain" />
              ) : (
                <QrCode className="size-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{m.name}</p>
              {m.instructions && (
                <p className="whitespace-pre-line text-muted-foreground">{m.instructions}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => openEdit(m)}
                aria-label={`Editar ${m.name}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => remove(m)}
                aria-label={`Quitar ${m.name}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <PaymentMethodDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
        onSaved={load}
      />
    </div>
  );
}

export function AdminConfiguracion() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!loading && !user) window.location.href = "/auth";
  }, [loading, user]);

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
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-semibold">Configuración</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Precios, métodos de pago (con su QR) e iglesias/ministerios del formulario.
      </p>

      <div className="mt-6">
        <PreciosPanel />
      </div>
      <PaymentMethodsPanel />
      <CatalogPanel />
    </main>
  );
}
