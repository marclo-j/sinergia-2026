import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().trim().email("Correo inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
  fullName: z.string().trim().max(120).optional(),
});

export function AuthForm() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) window.location.href = "/inscripcion";
  }, [user, loading]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    if (mode === "signup" && (parsed.data.fullName?.length ?? 0) < 3) {
      toast.error("Escribe tu nombre completo");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/inscripcion`,
            data: { full_name: parsed.data.fullName },
          },
        });
        if (error) throw error;
        toast.success("Cuenta creada. ¡Continúa con tu inscripción!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success("Bienvenido de vuelta");
      }
      window.location.href = "/inscripcion";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos completar la operación");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl">{mode === "login" ? "Ingresa" : "Crea tu cuenta"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Necesitas una cuenta para inscribirte, ver tu QR y marcar la entrega de materiales.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="fullName">Nombre completo</Label>
            <Input
              id="fullName"
              value={fullName}
              maxLength={120}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="María Fernández"
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            value={email}
            maxLength={255}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@ejemplo.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            value={password}
            maxLength={72}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Procesando…" : mode === "login" ? "Ingresar" : "Crear cuenta"}
        </Button>
      </form>

      <button
        type="button"
        className="mt-6 text-sm underline underline-offset-4"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
      >
        {mode === "login" ? "No tengo cuenta, quiero registrarme" : "Ya tengo cuenta, ingresar"}
      </button>

      <p className="mt-8 text-sm">
        <a href="/" className="underline underline-offset-4">
          Volver al inicio
        </a>
      </p>
    </main>
  );
}
