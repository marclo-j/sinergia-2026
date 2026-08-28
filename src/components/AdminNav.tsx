import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Nav exclusivo del panel admin: nada del sitio público (Inicio, Programa,
// Merch, Inscripción) — solo las secciones del equipo organizador.
const links = [
  { to: "/admin/entradas", label: "Entradas" },
  { to: "/admin/escanear", label: "Escanear" },
  { to: "/admin/materiales", label: "Materiales" },
  { to: "/admin/usuarios", label: "Usuarios" },
  { to: "/admin/configuracion", label: "Configuración" },
] as const;

export function AdminNav({ currentPath = "/admin/entradas" }: { currentPath?: string }) {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  const signOut = () => {
    logout();
    window.location.href = "/";
  };

  const isActive = (to: string) => currentPath.startsWith(to);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <a href="/admin/entradas" className="shrink-0 text-sm font-semibold tracking-wide uppercase">
          Sinergia · Admin
        </a>

        {/* Nav horizontal: md y más grande */}
        <nav className="hidden items-center gap-6 text-sm md:flex">
          {links.map((l) => (
            <a
              key={l.to}
              href={l.to}
              className={`whitespace-nowrap transition-colors hover:text-primary ${
                isActive(l.to) ? "font-semibold text-primary" : "text-muted-foreground"
              }`}
            >
              {l.label}
            </a>
          ))}
          <button type="button" onClick={signOut} className="text-muted-foreground hover:text-destructive">
            Salir
          </button>
        </nav>

        {/* Botón hamburguesa: pantallas chicas (< md) */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          className="text-muted-foreground hover:text-foreground md:hidden"
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {/* Menú desplegable: pantallas chicas (< md) */}
      {open && (
        <nav className="flex flex-col border-t border-border px-4 py-2 md:hidden">
          {links.map((l) => (
            <a
              key={l.to}
              href={l.to}
              onClick={() => setOpen(false)}
              className={`rounded-md px-2 py-2.5 text-sm transition-colors ${
                isActive(l.to) ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {l.label}
            </a>
          ))}
          <button
            type="button"
            onClick={signOut}
            className="rounded-md px-2 py-2.5 text-left text-sm text-muted-foreground hover:text-destructive"
          >
            Salir
          </button>
        </nav>
      )}
    </header>
  );
}
