import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Check, CreditCard, Upload, User } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const PRICE = 10;

const dataSchema = z.object({
  full_name: z.string().trim().min(3, "Escribe tu nombre completo").max(120),
  phone: z.string().trim().min(6, "Teléfono inválido").max(20),
  church: z.string().trim().max(120).optional(),
});

const methods = [
  { id: "yape", label: "Yape", detail: "Yapea al 900 000 000 — Conferencia Sinergia" },
  { id: "plin", label: "Plin", detail: "Plin al 900 000 000 — Conferencia Sinergia" },
  {
    id: "transferencia",
    label: "Transferencia",
    detail: "BCP Soles 191-0000000-0-00 · CCI 002-191-000000000000-00",
  },
];

type Registration = {
  id: string;
  ticket_code: string;
  status: "pending" | "review" | "paid" | "rejected";
  full_name: string;
  phone: string | null;
  church: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  receipt_url: string | null;
};

function newTicketCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const bytes = new Uint32Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `SIN26-${s}`;
}

export function InscripcionForm() {
  const { user, loading } = useAuth();
  const [reg, setReg] = useState<Registration | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [church, setChurch] = useState("");
  const [method, setMethod] = useState("yape");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!loading && !user) window.location.href = "/auth";
  }, [loading, user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("registrations")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (data) {
        const r = data as unknown as Registration;
        setReg(r);
        setFullName(r.full_name);
        setPhone(r.phone ?? "");
        setChurch(r.church ?? "");
        setMethod(r.payment_method ?? "yape");
        setReference(r.payment_reference ?? "");
      } else {
        setFullName((user.user_metadata?.["full_name"] as string) ?? "");
      }
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const step = !reg ? 1 : reg.status === "pending" ? 2 : 3;

  const saveData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = dataSchema.safeParse({ full_name: fullName, phone, church });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisa tus datos");
      return;
    }
    setBusy(true);
    const payload = {
      user_id: user.id,
      ticket_code: newTicketCode(),
      full_name: parsed.data.full_name,
      email: user.email ?? "",
      phone: parsed.data.phone,
      church: parsed.data.church ?? null,
      amount: PRICE,
    };
    const { data, error } = await supabase
      .from("registrations")
      .insert(payload)
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase
      .from("profiles")
      .update({ full_name: parsed.data.full_name, phone: parsed.data.phone, church: parsed.data.church ?? null })
      .eq("id", user.id);
    setReg(data as unknown as Registration);
    toast.success("Datos guardados. Ahora realiza el pago.");
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reg) return;
    if (reference.trim().length < 3) {
      toast.error("Ingresa el número de operación o una referencia");
      return;
    }
    setBusy(true);
    let receiptPath = reg.receipt_url;
    try {
      if (file) {
        if (file.size > 10 * 1024 * 1024) throw new Error("El archivo supera los 10MB");
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${user.id}/comprobante-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("receipts").upload(path, file, {
          upsert: true,
        });
        if (upErr) throw upErr;
        receiptPath = path;
      }
      const { data, error } = await supabase
        .from("registrations")
        .update({
          payment_method: method,
          payment_reference: reference.trim().slice(0, 120),
          receipt_url: receiptPath,
          status: "review",
        })
        .eq("id", reg.id)
        .select("*")
        .single();
      if (error) throw error;
      setReg(data as unknown as Registration);
      toast.success("Comprobante enviado. Validaremos tu pago pronto.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos registrar el pago");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <ol className="mb-10 grid gap-3 sm:grid-cols-3">
        {[
          { n: 1, label: "Tus datos", icon: User },
          { n: 2, label: "Pago", icon: CreditCard },
          { n: 3, label: "Entrada QR", icon: Check },
        ].map((s) => (
          <li
            key={s.n}
            className={`print-block flex items-center gap-3 p-3 ${
              step >= s.n ? "bg-accent text-accent-foreground" : "bg-card"
            }`}
          >
            <s.icon className="size-5" />
            <span className="font-display text-sm">
              {s.n}. {s.label}
            </span>
          </li>
        ))}
      </ol>

      {!ready && <p className="text-muted-foreground">Cargando tu inscripción…</p>}

      {ready && step === 1 && (
        <form onSubmit={saveData} className="print-block space-y-4 bg-card p-6">
          <h2 className="font-display text-xl">Paso 1 — Tus datos</h2>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre completo</Label>
            <Input id="nombre" value={fullName} maxLength={120} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tel">Teléfono / WhatsApp</Label>
            <Input id="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="iglesia">Iglesia o ministerio (opcional)</Label>
            <Input id="iglesia" value={church} maxLength={120} onChange={(e) => setChurch(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Guardando…" : "Continuar al pago"}
          </Button>
        </form>
      )}

      {ready && step === 2 && reg && (
        <form onSubmit={submitPayment} className="print-block space-y-5 bg-card p-6">
          <h2 className="font-display text-xl">Paso 2 — Paga S/ {PRICE}.00</h2>
          <p className="text-sm text-muted-foreground">
            Realiza el pago por el medio que prefieras y sube tu comprobante. Tu código de entrada
            es <strong>{reg.ticket_code}</strong> — úsalo como concepto del pago.
          </p>

          <div className="grid gap-3">
            {methods.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer gap-3 border-2 p-4 ${
                  method === m.id ? "border-primary bg-secondary" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="method"
                  value={m.id}
                  checked={method === m.id}
                  onChange={() => setMethod(m.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-display text-sm">{m.label}</span>
                  <span className="block text-sm text-muted-foreground">{m.detail}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ref">Número de operación o referencia</Label>
            <Textarea
              id="ref"
              value={reference}
              maxLength={120}
              rows={2}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej. 0012345 — Yape a nombre de María F."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file" className="flex items-center gap-2">
              <Upload className="size-4" /> Captura del comprobante (opcional, máx. 10MB)
            </Label>
            <Input
              id="file"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <Button type="submit" disabled={busy}>
            {busy ? "Enviando…" : "Enviar comprobante"}
          </Button>
        </form>
      )}

      {ready && step === 3 && reg && (
        <div className="print-block space-y-4 bg-card p-6">
          <h2 className="font-display text-xl">Paso 3 — Tu entrada</h2>
          {reg.status === "review" && (
            <p className="text-sm text-muted-foreground">
              Recibimos tu comprobante. Estamos validando el pago; mientras tanto ya puedes ver tu
              código QR provisional.
            </p>
          )}
          {reg.status === "paid" && (
            <p className="text-sm text-muted-foreground">
              ¡Pago confirmado! Presenta tu QR en el ingreso y para recoger tus materiales.
            </p>
          )}
          {reg.status === "rejected" && (
            <p className="text-sm text-destructive">
              Tu pago fue rechazado. Escríbenos por WhatsApp para regularizarlo.
            </p>
          )}
          <a
            href="/mi-entrada"
            className="inline-flex bg-primary px-5 py-3 font-display text-sm text-primary-foreground"
          >
            Ver mi entrada y QR
          </a>
        </div>
      )}
    </main>
  );
}
