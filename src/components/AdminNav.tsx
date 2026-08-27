import { useAuth } from "@/hooks/useAuth";

// Nav exclusivo del panel admin: nada del sitio público (Inicio, Programa,
// Merch, Inscripción) — solo las secciones del equipo organizador.
const links = [
  { to: "/admin/entradas", label: "Entradas" },
  { to: "/admin/usuarios", label: "Usuarios" },
  { to: "/admin/configuracion", label: "Configuración" },
] as const;

export function AdminNav({ currentPath = "/admin/entradas" }: { currentPath?: string }) {
  const { logout } = useAuth();

  const signOut = () => {
    logout();
    window.location.href = "/";
  };

  const isActive = (to: string) => currentPath.startsWith(to);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <a href="/admin/entradas" className="text-sm font-semibold tracking-wide uppercase">
          Sinergia · Admin
        </a>

        <nav className="flex items-center gap-6 text-sm">
          {links.map((l) => (
            <a
              key={l.to}
              href={l.to}
              className={`transition-colors hover:text-primary ${
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
      </div>
    </header>
  );
}
