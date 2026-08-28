import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import QrCode from "lucide-react/dist/esm/icons/qr-code";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = {
  id: string;
  ticket_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: "pending" | "review" | "paid" | "rejected";
  payment_method: string | null;
  payment_reference: string | null;
  receipt_url: string | null;
  materials_picked_up: boolean;
  checked_in_at: string | null;
};

export function AdminPanel() {
  const { user, loading } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const [code, setCode] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!loading && !user) window.location.href = "/auth";
  }, [loading, user]);

  const reload = useCallback(async () => {
    if (!isAdmin) return;
    const { data, error } = await (await getSupabase())
      .from("registrations")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRows(data as unknown as Row[]);
  }, [isAdmin]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setStatus = async (id: string, status: Row["status"]) => {
    const { error } = await (await getSupabase()).from("registrations").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Estado actualizado");
    reload();
  };

  const toggleMaterials = async (row: Row) => {
    const { error } = await (await getSupabase())
      .from("registrations")
      .update({
        materials_picked_up: !row.materials_picked_up,
        materials_picked_up_at: row.materials_picked_up ? null : new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    reload();
  };

  const validate = async () => {
    const ticket = code.trim().toUpperCase();
    if (!ticket) return;
    const { data, error } = await (await getSupabase())
      .from("registrations")
      .select("*")
      .eq("ticket_code", ticket)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data) {
      toast.error("Código no encontrado");
      return;
    }
    const row = data as unknown as Row;
    if (row.status !== "paid") {
      toast.error(`${row.full_name}: pago no confirmado`);
      return;
    }
    await (await getSupabase())
      .from("registrations")
      .update({ checked_in_at: new Date().toISOString() })
      .eq("id", row.id);
    toast.success(`Ingreso válido — ${row.full_name}`);
    setCode("");
    reload();
  };

  const openReceipt = async (path: string) => {
    const { data, error } = await (await getSupabase()).storage.from("receipts").createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("No pudimos abrir el comprobante");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
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
                <td className="p-2 font-mono text-xs">{r.ticket_code}</td>
                <td className="p-2">
                  {r.full_name}
                  <span className="block text-xs text-muted-foreground">{r.email}</span>
                </td>
                <td className="p-2">
                  {r.payment_method ?? "—"}
                  <span className="block text-xs text-muted-foreground">{r.payment_reference ?? ""}</span>
                  {r.receipt_url && (
                    <button className="text-xs underline" onClick={() => openReceipt(r.receipt_url!)}>
                      Ver comprobante
                    </button>
                  )}
                </td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">
                  <button className="text-xs underline" onClick={() => toggleMaterials(r)}>
                    {r.materials_picked_up ? "Recogidos" : "Pendiente"}
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
