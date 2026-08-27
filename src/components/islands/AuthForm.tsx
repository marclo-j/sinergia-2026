import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { login, setToken } from "@/lib/api/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RetroWindow } from "@/components/ui/retro-window";

const loginSchema = z.object({
  email: z.string().trim().email("Correo inválido").max(255),
  password: z.string().min(1, "Ingresa tu contraseña").max(72),
});

export function AuthForm() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) window.location.href = "/inscripcion";
  }, [user, loading]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setBusy(true);
    try {
      const { token } = await login(parsed.data);
      setToken(token);
      toast.success("Bienvenido de vuelta");
      window.location.href = "/inscripcion";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos iniciar sesión");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="font-pixel text-[10px] tracking-widest text-primary">&gt; ACCESO.SYS</p>
      <h1 className="font-display text-pop mt-2 text-5xl leading-none text-accent">Login</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Ingresa con tu correo y contraseña para ver tu inscripción y tu entrada.
      </p>

      <div className="mt-8">
        <RetroWindow title="LOGIN.EXE">
          <form onSubmit={submit} className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                value={email}
                maxLength={255}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  maxLength={72}
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="font-pixel w-full text-xs tracking-widest" disabled={busy}>
              {busy ? "CARGANDO…" : ">> INGRESAR"}
            </Button>
          </form>
        </RetroWindow>
      </div>

      <p className="mt-8 text-sm">
        ¿No tienes cuenta?{" "}
        <a href="/inscripcion" className="underline underline-offset-4">
          Inscríbete aquí
        </a>
      </p>
      <p className="mt-2 text-sm">
        <a href="/" className="underline underline-offset-4">
          Volver al inicio
        </a>
      </p>
    </main>
  );
}
