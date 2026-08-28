import Menu from "lucide-react/dist/esm/icons/menu";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/", label: "Inicio" },
  { to: "/programa", label: "Programa" },
  { to: "/merch", label: "Merch" },
  { to: "/inscripcion", label: "Inscripción" },
] as const;

export function SiteHeader({ currentPath = "/" }: { currentPath?: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    const client = await getSupabase();
    await client.auth.signOut();
    window.location.href = "/";
  };

  const isActive = (to: string) =>
    to === "/" ? currentPath === "/" : currentPath.startsWith(to);

  return (
    <header className="sticky top-0 z-50 bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-4 px-4 py-7">
        <nav className="font-nav hidden items-center gap-16 text-2xl font-medium md:flex">
          {links.map((l) => (
            <a
              key={l.to}
              href={l.to}
              className="font-nav transition-colors hover:text-accent"
            >
              {l.label}
            </a>
          ))}
          {user ? (
            <>
              <a
                href="/mi-entrada"
                className="font-nav transition-colors hover:text-accent"
              >
                Mi entrada
              </a>
              <Button variant="ghost" size="sm" onClick={signOut}>
                Salir
              </Button>
            </>
          ) : (
            <a
              href="/auth"
              className="font-nav transition-colors hover:text-accent"
            >
              Ingresar
            </a>
          )}
        </nav>

        <button
          type="button"
          aria-label="Abrir menú"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {open && (
        <nav className="font-nav flex flex-col gap-1 border-t border-primary-foreground/20 px-4 pb-4 text-sm md:hidden">
          {links.map((l) => (
            <a
              key={l.to}
              href={l.to}
              className="py-2"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          {user ? (
            <>
              <a
                href="/mi-entrada"
                className="py-2"
                onClick={() => setOpen(false)}
              >
                Mi entrada
              </a>
              <button
                type="button"
                className="py-2 text-left"
                onClick={signOut}
              >
                Salir
              </button>
            </>
          ) : (
            <a href="/auth" className="py-2" onClick={() => setOpen(false)}>
              Ingresar
            </a>
          )}
        </nav>
      )}
    </header>
  );
}
