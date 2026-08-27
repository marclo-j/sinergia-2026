import { useEffect, useState, useCallback, type ChangeEvent } from "react";
import { toast } from "sonner";
import { QrCode, ShieldCheck, Settings as SettingsIcon, Church, Users, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchSettings,
  updateSettings,
  uploadYapeQr,
  yapeQrUrl,
  fetchCatalog,
  createCatalogItem,
  deleteCatalogItem,
  type Settings,
  type CatalogType,
  type CatalogItem,
} from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toDateInputValue(iso: string) {
  return iso.slice(0, 10);
}

function PreciosPanel() {
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
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-medium">
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
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Configuración</h1>
      <p className="mt-1 text-sm text-muted-foreground">Precios, QR de pago e iglesias/ministerios del formulario.</p>

      <div className="mt-6">
        <PreciosPanel />
      </div>
      <CatalogPanel />
    </main>
  );
}
