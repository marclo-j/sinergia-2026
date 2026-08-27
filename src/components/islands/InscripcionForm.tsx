import { Fragment, useEffect, useState, type ChangeEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  User,
  IdCard,
  CalendarDays,
  Mail,
  Phone,
  Church,
  Users,
  Paperclip,
  FileText,
  Megaphone,
  Send,
  BadgeCheck,
  Clock3,
  XCircle,
  UserCheck,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  registerAccount,
  setToken,
  submitPayment,
  fetchSettings,
  yapeQrUrl,
  type Settings,
  type PublicUser,
  type PublicRegistration,
} from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IconBadge } from "@/components/ui/icon-badge";
import { RetroWindow } from "@/components/ui/retro-window";

// ---------------------------------------------------------------------------
// Paso 1 (sin sesión): crear cuenta con datos personales y ministeriales.
// ---------------------------------------------------------------------------

const signupSchema = z
  .object({
    email: z.string().trim().email("Correo inválido").max(255),
    password: z.string().min(6, "Mínimo 6 caracteres").max(72),
    confirmPassword: z.string().min(1, "Confirma tu contraseña"),
    nombres: z.string().trim().min(2, "Escribe tus nombres").max(80),
    apellidos: z.string().trim().min(2, "Escribe tus apellidos").max(80),
    tipoDocumento: z.enum(["dni", "pasaporte"]),
    numeroDocumento: z.string().trim().min(3, "Ingresa tu número de documento").max(20),
    fechaNacimiento: z.string().trim().min(1, "Ingresa tu fecha de nacimiento"),
    telefono: z.string().trim().min(6, "Teléfono inválido").max(20),
    iglesia: z.string().trim().max(120).optional(),
    ministerio: z.string().trim().max(120).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })
  .refine((data) => data.tipoDocumento !== "dni" || /^\d{8}$/.test(data.numeroDocumento), {
    message: "El DNI debe tener 8 dígitos",
    path: ["numeroDocumento"],
  });

type SignupState = {
  email: string;
  password: string;
  confirmPassword: string;
  nombres: string;
  apellidos: string;
  tipoDocumento: "dni" | "pasaporte";
  numeroDocumento: string;
  fechaNacimiento: string;
  telefono: string;
  iglesia: string;
  ministerio: string;
};

const initialSignup: SignupState = {
  email: "",
  password: "",
  confirmPassword: "",
  nombres: "",
  apellidos: "",
  tipoDocumento: "dni",
  numeroDocumento: "",
  fechaNacimiento: "",
  telefono: "",
  iglesia: "",
  ministerio: "",
};

type SignupField = {
  key: keyof Omit<SignupState, "email" | "password" | "confirmPassword" | "tipoDocumento" | "numeroDocumento">;
  label: string;
  icon: LucideIcon;
  type?: string;
  placeholder: string;
};

const signupFields: SignupField[] = [
  { key: "nombres", label: "Nombres", icon: User, placeholder: "Ingresa tus nombres" },
  { key: "apellidos", label: "Apellidos", icon: User, placeholder: "Ingresa tus apellidos" },
  { key: "fechaNacimiento", label: "Fecha de nacimiento", icon: CalendarDays, type: "date", placeholder: "" },
  { key: "telefono", label: "Teléfono", icon: Phone, type: "tel", placeholder: "Ingresa tu número de teléfono" },
  { key: "iglesia", label: "Iglesia", icon: Church, placeholder: "Ingresa el nombre de tu iglesia" },
  { key: "ministerio", label: "Ministerio", icon: Users, placeholder: "¿En qué ministerio sirves? (opcional)" },
];

function SignupSection({ onDone }: { onDone: () => Promise<void> }) {
  const [signup, setSignup] = useState<SignupState>(initialSignup);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const setValue = (key: keyof SignupState) => (e: ChangeEvent<HTMLInputElement>) =>
    setSignup((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse(signup);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisa tus datos");
      return;
    }
    setBusy(true);
    try {
      const { token } = await registerAccount(parsed.data);
      setToken(token);
      toast.success("Cuenta creada. ¡Ahora solo falta el pago!");
      await onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos crear tu cuenta");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <RetroWindow title="REGISTRO.EXE">
        <form onSubmit={submit} className="paper-kraft space-y-6 p-6 md:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              {signupFields.map((f) => (
                <Fragment key={f.key}>
                  <div className="space-y-2">
                    <Label htmlFor={f.key} className="flex items-center gap-3 font-display text-sm normal-case">
                      <IconBadge icon={f.icon} /> {f.label}
                    </Label>
                    <Input
                      id={f.key}
                      type={f.type ?? "text"}
                      value={signup[f.key]}
                      placeholder={f.placeholder}
                      maxLength={120}
                      onChange={setValue(f.key)}
                      className="bg-card"
                    />
                  </div>

                  {f.key === "apellidos" && (
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="numeroDocumento" className="flex items-center gap-3 font-display text-sm normal-case">
                        <IconBadge icon={IdCard} /> Documento
                      </Label>
                      <div className="flex gap-2">
                        <div className="flex shrink-0 border-2 border-ink">
                          {(["dni", "pasaporte"] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setSignup((prev) => ({ ...prev, tipoDocumento: t }))}
                              className={`px-3 font-pixel text-[10px] tracking-widest ${
                                signup.tipoDocumento === t
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-card text-muted-foreground"
                              }`}
                            >
                              {t === "dni" ? "DNI" : "PASAPORTE"}
                            </button>
                          ))}
                        </div>
                        <Input
                          id="numeroDocumento"
                          value={signup.numeroDocumento}
                          placeholder={signup.tipoDocumento === "dni" ? "Ingresa tu DNI" : "Ingresa tu N° de pasaporte"}
                          maxLength={signup.tipoDocumento === "dni" ? 8 : 20}
                          onChange={setValue("numeroDocumento")}
                          className="bg-card"
                        />
                      </div>
                    </div>
                  )}
                </Fragment>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="signupEmail" className="flex items-center gap-3 font-display text-sm normal-case">
                <IconBadge icon={Mail} /> Correo electrónico
              </Label>
              <Input
                id="signupEmail"
                type="email"
                value={signup.email}
                maxLength={255}
                autoComplete="email"
                onChange={setValue("email")}
                placeholder="tucorreo@ejemplo.com"
                className="bg-card"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="signupPassword">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="signupPassword"
                    type={showPassword ? "text" : "password"}
                    value={signup.password}
                    maxLength={72}
                    autoComplete="new-password"
                    onChange={setValue("password")}
                    className="bg-card pr-9"
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
                <p className="text-xs text-kraft-foreground/70">Mínimo 6 caracteres.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirma tu contraseña</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={signup.confirmPassword}
                  maxLength={72}
                  autoComplete="new-password"
                  onChange={setValue("confirmPassword")}
                  className="bg-card"
                />
              </div>
            </div>

          <Button type="submit" size="lg" disabled={busy} className="font-pixel w-full text-xs tracking-widest">
            {busy ? "CREANDO CUENTA…" : ">> CREAR MI CUENTA"}
          </Button>
        </form>
      </RetroWindow>

      <a
        href="/auth"
        className="print-block mt-8 inline-flex items-center gap-2 bg-background px-6 py-3 font-pixel text-xs tracking-widest text-foreground transition-transform hover:-translate-y-0.5"
      >
        ¿YA TIENES CUENTA? <span className="text-primary">&gt;&gt; INICIA SESIÓN</span>
      </a>
    </>
  );
}

// ---------------------------------------------------------------------------
// Paso 2 (con sesión): pagar la entrada.
// ---------------------------------------------------------------------------

const methods = [
  { id: "yape", label: "Yape", detail: "Escanea el QR o yapea al 900 000 000" },
  { id: "plin", label: "Plin", detail: "Plin al 900 000 000 — Conferencia Sinergia" },
  {
    id: "transferencia",
    label: "Transferencia",
    detail: "BCP Soles 191-0000000-0-00 · CCI 002-191-000000000000-00",
  },
];

function Dropzone({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  return (
    <label className="relative flex cursor-pointer items-center justify-center gap-2 border-2 border-dashed border-electric/50 bg-electric/5 px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:bg-electric/10">
      <FileText className="size-4 shrink-0" />
      <span>{file ? file.name : "Selecciona o arrastra tu comprobante aquí"}</span>
      <input
        type="file"
        accept="image/*,application/pdf"
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function PixelLoader() {
  return (
    <div className="flex gap-1 border-2 border-ink bg-ink p-1.5">
      {Array.from({ length: 16 }).map((_, i) => (
        <span
          key={i}
          className="pixel-load-bar h-4 flex-1 bg-electric"
          style={{ animationDelay: `${i * 0.07}s` }}
        />
      ))}
    </div>
  );
}

function Stepper({ paid }: { paid: boolean }) {
  return (
    <ol className="mb-8 flex items-stretch gap-2">
      <li className="print-block flex flex-1 items-center gap-3 bg-accent p-3 text-accent-foreground">
        <UserCheck className="size-5 shrink-0" />
        <span className="font-pixel text-[10px] tracking-widest sm:text-xs">[01] INSCRIPCION</span>
      </li>
      <li className="hidden items-center font-pixel text-lg text-muted-foreground sm:flex">&gt;&gt;</li>
      <li
        className={`print-block flex flex-1 items-center gap-3 p-3 ${
          paid ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
        }`}
      >
        <CreditCard className="size-5 shrink-0" />
        <span className="font-pixel text-[10px] tracking-widest sm:text-xs">[02] PAGO</span>
      </li>
    </ol>
  );
}

function PriceBanner({ settings }: { settings: Settings }) {
  const preventaVigente = settings.currentPrice.label === "preventa";
  const hasta = new Date(settings.preventaHasta).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
  });
  return (
    <div className="flex flex-col items-center gap-3 border-2 border-ink bg-ember px-4 py-4 text-center text-ember-foreground sm:flex-row sm:justify-center sm:gap-6 sm:text-left">
      <span className="flex items-center gap-2 font-pixel text-[10px] tracking-widest">
        <Megaphone className="size-4" /> PRECIOS
      </span>
      <span
        className={`font-pixel text-[11px] tracking-wide ${preventaVigente ? "text-glow" : "opacity-70"}`}
      >
        {preventaVigente ? "▶" : "  "} PREVENTA S/ {settings.pricePreventa}.00 (HASTA EL{" "}
        {hasta.toUpperCase()})
      </span>
      <span className="hidden h-5 w-px bg-ember-foreground/30 sm:block" />
      <span
        className={`font-pixel text-[11px] tracking-wide ${!preventaVigente ? "text-glow" : "opacity-70"}`}
      >
        {!preventaVigente ? "▶" : "  "} VENTA S/ {settings.precioVenta}.00
      </span>
    </div>
  );
}

function PaymentSection({
  user,
  registration,
  settings,
  onPaid,
}: {
  user: PublicUser;
  registration: PublicRegistration;
  settings: Settings | null;
  onPaid: () => Promise<void>;
}) {
  const [method, setMethod] = useState("yape");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submitPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reference.trim().length < 3) {
      toast.error("Ingresa el número de operación o una referencia");
      return;
    }
    const form = new FormData();
    form.set("method", method);
    form.set("reference", reference.trim());
    if (file) form.set("receipt", file);

    setBusy(true);
    try {
      await submitPayment(form);
      await onPaid();
      toast.success("Comprobante enviado. Validaremos tu pago pronto.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos registrar el pago");
    } finally {
      setBusy(false);
    }
  };

  const paymentFields = (submitLabel: string) => (
    <>
      <div className="grid gap-3">
        {methods.map((m) => (
          <div key={m.id}>
            <label
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
                <span className="font-pixel text-xs tracking-widest">{m.label.toUpperCase()}</span>
                <span className="block text-sm text-muted-foreground">{m.detail}</span>
              </span>
            </label>
            {m.id === "yape" && method === "yape" && (
              <div className="mt-3 flex justify-center border-2 border-border bg-card p-4">
                {settings?.hasYapeQr ? (
                  <img src={yapeQrUrl()} alt="Código QR de Yape" className="w-48" />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Aún no hay un QR configurado; usa el número de Yape indicado arriba.
                  </p>
                )}
              </div>
            )}
          </div>
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
        <Label className="flex items-center gap-2">
          <Paperclip className="size-4" /> Comprobante de pago (opcional, imagen o PDF, máx. 10MB)
        </Label>
        <Dropzone file={file} onChange={setFile} />
      </div>

      <Button type="submit" disabled={busy} className="font-pixel gap-2 text-xs tracking-widest">
        {busy ? "ENVIANDO…" : submitLabel.toUpperCase()}
        {!busy && <Send className="size-4" />}
      </Button>
    </>
  );

  return (
    <>
      <div className="print-block mb-8 inline-block bg-background/95 px-5 py-4">
        <p className="font-pixel text-[10px] tracking-widest text-primary">&gt; PAGO.SYS</p>
        <h1 className="font-display text-pop mt-2 text-5xl leading-none text-accent sm:text-6xl">
          Paga tu entrada
        </h1>
      </div>

      <Stepper paid={registration.status === "paid"} />

      <RetroWindow title="TICKET.DAT">
        <div className="bg-ink p-6 text-center">
          <p className="font-pixel text-[10px] tracking-widest text-electric">TU CÓDIGO DE ENTRADA</p>
          <p className="font-pixel text-glow mt-2 text-3xl tracking-widest text-accent">
            {registration.ticketCode}
            <span className="cursor-blink">_</span>
          </p>
          <p className="mt-2 text-sm text-background/70">
            {user.nombres} {user.apellidos} · {user.email}
          </p>
        </div>
      </RetroWindow>

      {registration.status === "pending" && (
        <div className="mt-6">
          <RetroWindow title="PAGO.EXE">
            <form onSubmit={submitPay} className="space-y-5 p-6">
              <h2 className="font-pixel text-lg tracking-widest text-primary">
                PAGA S/ {registration.amount}.00
              </h2>
              <p className="text-sm text-muted-foreground">
                Realiza el pago por el medio que prefieras, sube tu comprobante y usa tu código{" "}
                <strong className="font-pixel">{registration.ticketCode}</strong> como concepto.
              </p>
              {paymentFields("Enviar comprobante")}
            </form>
          </RetroWindow>
        </div>
      )}

      {registration.status === "review" && (
        <div className="mt-6">
          <RetroWindow title="VALIDANDO.EXE">
            <div className="space-y-4 p-6">
              <p className="flex items-center gap-2 font-pixel text-xs tracking-widest text-electric">
                <Clock3 className="size-4" /> SE ESTÁ VALIDANDO TU PEDIDO…
              </p>
              <PixelLoader />
              <p className="text-sm text-muted-foreground">
                Recibimos tu comprobante. En el transcurso del día te llegará una notificación a tu
                correo <strong>{user.email}</strong> confirmando tu inscripción; mientras tanto ya
                puedes ver tu código QR provisional.
              </p>
              <a
                href="/mi-entrada"
                className="font-pixel inline-flex bg-primary px-5 py-3 text-xs tracking-widest text-primary-foreground"
              >
                &gt;&gt; VER MI ENTRADA Y QR
              </a>
            </div>
          </RetroWindow>
        </div>
      )}

      {registration.status === "paid" && (
        <div className="mt-6">
          <RetroWindow title="CONFIRMADO.OK">
            <div className="space-y-4 p-6">
              <p className="flex items-center gap-2 font-pixel text-xs tracking-widest text-accent">
                <BadgeCheck className="size-4" /> ¡PAGO CONFIRMADO!
              </p>
              <p className="text-sm text-muted-foreground">
                Presenta tu QR en el ingreso y para recoger tus materiales.
              </p>
              <a
                href="/mi-entrada"
                className="font-pixel inline-flex bg-primary px-5 py-3 text-xs tracking-widest text-primary-foreground"
              >
                &gt;&gt; VER MI ENTRADA Y QR
              </a>
            </div>
          </RetroWindow>
        </div>
      )}

      {registration.status === "rejected" && (
        <div className="mt-6">
          <RetroWindow title="ERROR.LOG">
            <form onSubmit={submitPay} className="space-y-5 p-6">
              <p className="flex items-center gap-2 font-pixel text-xs tracking-widest text-destructive">
                <XCircle className="size-4" /> TU PAGO FUE RECHAZADO
              </p>
              <p className="text-sm text-muted-foreground">
                Revisa el número de operación o el comprobante y vuelve a enviarlo.
              </p>
              {paymentFields("Reenviar comprobante")}
            </form>
          </RetroWindow>
        </div>
      )}

      {settings && (
        <div className="mt-4">
          <PriceBanner settings={settings} />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

export function InscripcionForm() {
  const { user, registration, loading, refresh } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    fetchSettings()
      .then(({ settings }) => setSettings(settings))
      .catch(() => {});
  }, []);

  if (loading || (user && !registration)) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-14">
        <p className="print-block inline-block bg-background/95 px-4 py-2 font-pixel text-sm text-primary">
          &gt; CARGANDO_DATOS<span className="cursor-blink">_</span>
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <SignupSection onDone={refresh} />
      </main>
    );
  }

  if (!registration) return null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <PaymentSection user={user} registration={registration} settings={settings} onPaid={refresh} />
    </main>
  );
}
