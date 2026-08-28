import { Fragment, useEffect, useState, type ChangeEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "motion/react";
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
  X,
  Check,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  registerAccount,
  setToken,
  submitPayment,
  fetchSettings,
  fetchCatalog,
  fetchPaymentMethods,
  paymentMethodQrUrl,
  type Settings,
  type PublicUser,
  type PublicRegistration,
  type CatalogItem,
  type PaymentMethodItem,
} from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { IconBadge } from "@/components/ui/icon-badge";
import { RetroWindow } from "@/components/ui/retro-window";

// Entrada estándar (fade + slide-up) para las secciones de la página.
// Valor centinela para la opción "Otros" de los <select> de iglesia/ministerio.
const OTRO = "__otro__";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

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
];

function SignupSection({ onDone }: { onDone: () => Promise<void> }) {
  const [signup, setSignup] = useState<SignupState>(initialSignup);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [iglesias, setIglesias] = useState<CatalogItem[]>([]);
  const [ministerios, setMinisterios] = useState<CatalogItem[]>([]);
  const [iglesiaOtro, setIglesiaOtro] = useState(false);
  const [ministerioOtro, setMinisterioOtro] = useState(false);

  useEffect(() => {
    fetchCatalog("iglesias").then(({ items }) => setIglesias(items)).catch(() => {});
    fetchCatalog("ministerios").then(({ items }) => setMinisterios(items)).catch(() => {});
  }, []);

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
      <motion.div {...fadeUp} transition={{ duration: 0.5, ease: "easeOut" }}>
      <RetroWindow title="REGISTRO.EXE">
        <form onSubmit={submit} className="paper-kraft space-y-6 p-6 md:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              {signupFields.map((f) => (
                <Fragment key={f.key}>
                  <div className="space-y-2">
                    <Label htmlFor={f.key} className="flex items-center gap-3">
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
                      <Label htmlFor="numeroDocumento" className="flex items-center gap-3">
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
                          inputMode={signup.tipoDocumento === "dni" ? "numeric" : "text"}
                          pattern={signup.tipoDocumento === "dni" ? "[0-9]*" : undefined}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const value = signup.tipoDocumento === "dni" ? raw.replace(/\D/g, "") : raw;
                            setSignup((prev) => ({ ...prev, numeroDocumento: value }));
                          }}
                          className="bg-card"
                        />
                      </div>
                    </div>
                  )}

                  {f.key === "telefono" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="iglesia" className="flex items-center gap-3">
                          <IconBadge icon={Church} /> Iglesia
                        </Label>
                        {iglesiaOtro ? (
                          <div className="space-y-1">
                            <Input
                              id="iglesia"
                              value={signup.iglesia}
                              autoFocus
                              placeholder="Escribe el nombre de tu iglesia"
                              onChange={(e) => setSignup((prev) => ({ ...prev, iglesia: e.target.value }))}
                              className="bg-card"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setIglesiaOtro(false);
                                setSignup((prev) => ({ ...prev, iglesia: "" }));
                              }}
                              className="text-xs underline underline-offset-2"
                            >
                              Elegir de la lista
                            </button>
                          </div>
                        ) : (
                          <Select
                            id="iglesia"
                            value={signup.iglesia}
                            onChange={(e) => {
                              if (e.target.value === OTRO) {
                                setIglesiaOtro(true);
                                setSignup((prev) => ({ ...prev, iglesia: "" }));
                              } else {
                                setSignup((prev) => ({ ...prev, iglesia: e.target.value }));
                              }
                            }}
                            className="bg-card"
                          >
                            <option value="">Selecciona tu iglesia (opcional)</option>
                            {iglesias.map((i) => (
                              <option key={i.id} value={i.name}>
                                {i.name}
                              </option>
                            ))}
                            <option value={OTRO}>Otros</option>
                          </Select>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ministerio" className="flex items-center gap-3">
                          <IconBadge icon={Users} /> Ministerio
                        </Label>
                        {ministerioOtro ? (
                          <div className="space-y-1">
                            <Input
                              id="ministerio"
                              value={signup.ministerio}
                              autoFocus
                              placeholder="Escribe el nombre de tu ministerio"
                              onChange={(e) => setSignup((prev) => ({ ...prev, ministerio: e.target.value }))}
                              className="bg-card"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setMinisterioOtro(false);
                                setSignup((prev) => ({ ...prev, ministerio: "" }));
                              }}
                              className="text-xs underline underline-offset-2"
                            >
                              Elegir de la lista
                            </button>
                          </div>
                        ) : (
                          <Select
                            id="ministerio"
                            value={signup.ministerio}
                            onChange={(e) => {
                              if (e.target.value === OTRO) {
                                setMinisterioOtro(true);
                                setSignup((prev) => ({ ...prev, ministerio: "" }));
                              } else {
                                setSignup((prev) => ({ ...prev, ministerio: e.target.value }));
                              }
                            }}
                            className="bg-card"
                          >
                            <option value="">Selecciona tu ministerio (opcional)</option>
                            {ministerios.map((m) => (
                              <option key={m.id} value={m.name}>
                                {m.name}
                              </option>
                            ))}
                            <option value={OTRO}>Otros</option>
                          </Select>
                        )}
                      </div>
                    </>
                  )}
                </Fragment>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="signupEmail" className="flex items-center gap-3">
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
                    preserveCase
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
                  preserveCase
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
      </motion.div>

      <motion.a
        href="/auth"
        {...fadeUp}
        transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.97 }}
        className="print-block mt-8 inline-flex items-center gap-2 bg-background px-6 py-3 font-pixel text-xs tracking-widest text-foreground"
      >
        ¿YA TIENES CUENTA? <span className="text-primary">&gt;&gt; INICIA SESIÓN</span>
      </motion.a>
    </>
  );
}

// ---------------------------------------------------------------------------
// Paso 2 (con sesión): pagar la entrada.
// ---------------------------------------------------------------------------

function Dropzone({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (file) {
    return (
      <div className="relative flex flex-col items-center justify-center gap-2 border-2 border-electric/50 bg-electric/5 px-4 py-6 text-center text-sm text-muted-foreground">
        {previewUrl && <img src={previewUrl} alt="Vista previa del comprobante" className="max-h-32 object-contain" />}
        <span>{file.name}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute top-2 right-2 flex size-7 items-center justify-center bg-destructive text-destructive-foreground"
          aria-label="Quitar imagen"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <label className="relative flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-electric/50 bg-electric/5 px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:bg-electric/10">
      <FileText className="size-4 shrink-0" />
      <span>Selecciona o arrastra la imagen de tu comprobante aquí</span>
      <input
        type="file"
        accept="image/*"
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function Stepper({ paid }: { paid: boolean }) {
  return (
    <ol className="mb-8 flex items-stretch gap-2">
      <li className="print-block flex flex-1 items-center gap-3 bg-accent p-3 text-accent-foreground">
        <UserCheck className="size-5 shrink-0" />
        <span className="font-pixel text-[10px] tracking-widest sm:text-xs">[01] INSCRIPCION</span>
        <Check className="ml-auto size-4 shrink-0" />
      </li>
      <li className="hidden items-center font-pixel text-lg text-muted-foreground sm:flex">&gt;&gt;</li>
      <li
        className={`print-block flex flex-1 items-center gap-3 p-3 ${
          paid ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
        }`}
      >
        <CreditCard className="size-5 shrink-0" />
        <span className="font-pixel text-[10px] tracking-widest sm:text-xs">[02] PAGO</span>
        {paid && <Check className="ml-auto size-4 shrink-0" />}
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
  const rows = [
    {
      label: "PREVENTA",
      amount: settings.pricePreventa,
      note: `Hasta el ${hasta}`,
      active: preventaVigente,
    },
    {
      label: "VENTA",
      amount: settings.precioVenta,
      note: `Desde el ${hasta}`,
      active: !preventaVigente,
    },
  ];
  return (
    <div className="border-2 border-ink bg-ember text-ember-foreground">
      <div className="flex items-center gap-2 border-b-2 border-ink px-4 py-2 font-pixel text-[10px] tracking-widest">
        <Megaphone className="size-4" /> PRECIOS
      </div>
      <table className="w-full border-collapse text-left">
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.label} className={row.active ? "bg-ember-foreground/10" : ""}>
              <td
                className={`px-4 py-2 font-pixel text-[10px] tracking-widest whitespace-nowrap ${
                  i > 0 ? "border-t-2 border-ink" : ""
                } ${row.active ? "text-glow" : "opacity-70"}`}
              >
                {row.active ? "▶ " : ""}
                {row.label}
              </td>
              <td
                className={`px-4 py-2 font-pixel text-sm whitespace-nowrap ${
                  i > 0 ? "border-t-2 border-ink" : ""
                } ${row.active ? "text-glow" : "opacity-70"}`}
              >
                S/ {row.amount}.00
              </td>
              <td className={`w-full px-4 py-2 text-xs ${i > 0 ? "border-t-2 border-ink" : ""} opacity-80`}>
                {row.note}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const [methods, setMethods] = useState<PaymentMethodItem[]>([]);
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchPaymentMethods()
      .then(({ methods }) => {
        setMethods(methods);
        setMethod((prev) => prev || methods[0]?.name || "");
      })
      .catch(() => {});
  }, []);

  const submitPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Sube la imagen de tu comprobante de pago");
      return;
    }
    const form = new FormData();
    form.set("method", method);
    if (reference.trim()) form.set("reference", reference.trim());
    form.set("receipt", file);

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
      {methods.length === 0 ? (
        <p className="border-2 border-dashed border-border p-4 text-sm text-muted-foreground">
          Aún no hay métodos de pago configurados. Escríbenos por WhatsApp para coordinar tu pago.
        </p>
      ) : (
        <div className="grid gap-3">
          {methods.map((m) => (
            <div key={m.id}>
              <label
                className={`flex cursor-pointer gap-3 border-2 p-4 ${
                  method === m.name ? "border-primary bg-secondary" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="method"
                  value={m.name}
                  checked={method === m.name}
                  onChange={() => setMethod(m.name)}
                  className="mt-1"
                />
                <span>
                  <span className="font-pixel text-xs tracking-widest">{m.name.toUpperCase()}</span>
                  <span className="block text-sm whitespace-pre-line text-muted-foreground">{m.instructions}</span>
                </span>
              </label>
              {method === m.name && m.hasQr && (
                <div className="mt-3 flex justify-center border-2 border-border bg-card p-4">
                  <img src={paymentMethodQrUrl(m.id)} alt={`Código QR de ${m.name}`} className="w-48" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="ref">Observación (opcional)</Label>
        <Textarea
          id="ref"
          value={reference}
          maxLength={120}
          rows={2}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Ej. Yape a nombre de María F."
        />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Paperclip className="size-4" /> Imagen del comprobante de pago (obligatorio, máx. 10MB)
        </Label>
        <Dropzone file={file} onChange={setFile} />
      </div>

      <Button
        type="submit"
        disabled={busy || methods.length === 0 || !file}
        size="lg"
        className="font-pixel w-full gap-2 text-sm tracking-widest"
      >
        {busy ? "ENVIANDO…" : submitLabel.toUpperCase()}
        {!busy && <Send className="size-4" />}
      </Button>
    </>
  );

  return (
    <>
      {settings && (
        <motion.div {...fadeUp} transition={{ duration: 0.5, ease: "easeOut" }} className="mb-6">
          <PriceBanner settings={settings} />
        </motion.div>
      )}

      <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}>
        <Stepper paid={registration.status === "paid"} />
      </motion.div>

      {registration.status === "pending" && (
        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }} className="mt-6">
          <RetroWindow title="PAGO.EXE">
            <form onSubmit={submitPay} className="space-y-5 p-6">
              <h2 className="font-pixel text-glow text-4xl tracking-widest text-primary sm:text-5xl">
                TOTAL S/ {registration.amount}.00
              </h2>
              <p className="text-sm text-muted-foreground">
                Realiza el pago por el medio que prefieras y sube tu comprobante; en la referencia
                incluye tu nombre completo para poder ubicarte.
              </p>
              {paymentFields("Enviar comprobante")}
            </form>
          </RetroWindow>
        </motion.div>
      )}

      {registration.status === "review" && (
        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }} className="mt-6">
          <RetroWindow title="VALIDANDO.EXE">
            <div className="space-y-4 p-6">
              <p className="flex items-center gap-2 font-pixel text-xs tracking-widest text-electric">
                <Clock3 className="size-4" /> SE ESTÁ VALIDANDO TU PEDIDO…
              </p>
              <p className="text-lg text-muted-foreground">
                Recibimos tu comprobante. En el transcurso del día te llegará una notificación a tu
                correo <strong>{user.email}</strong> confirmando tu inscripción.
              </p>
              <div className="flex flex-wrap gap-3">
                {settings?.whatsapp && (
                  <a
                    href={`https://wa.me/${settings.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-pixel inline-flex items-center gap-2 bg-accent px-5 py-3 text-xs tracking-widest text-accent-foreground"
                  >
                    <MessageCircle className="size-4" /> ESCRÍBENOS AL WHATSAPP
                  </a>
                )}
              </div>
            </div>
          </RetroWindow>
        </motion.div>
      )}

      {registration.status === "paid" && (
        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }} className="mt-6">
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
        </motion.div>
      )}

      {registration.status === "rejected" && (
        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }} className="mt-6">
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
        </motion.div>
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
