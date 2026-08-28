import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import logoSinergia from "@/assets/hero/sinergia_logo.webp";

const links = [
  { to: "/", label: "Inicio" },
  { to: "/programa", label: "Programa" },
  { to: "/merch", label: "Merch" },
  { to: "/inscripcion", label: "Inscripción" },
] as const;

const comingSoonLinks = new Set(["/programa", "/merch"]);

function NavLink({
  link,
  mobile = false,
  onClick,
}: {
  link: (typeof links)[number];
  mobile?: boolean;
  onClick?: () => void;
}) {
  const isComingSoon = comingSoonLinks.has(link.to);

  return (
    <span
      className={
        isComingSoon ? "relative inline-flex flex-col items-center" : "contents"
      }
    >
      {isComingSoon ? (
        <button
          type="button"
          disabled
          className={`font-inherit border-0 bg-transparent p-0 text-inherit disabled:cursor-not-allowed disabled:opacity-100 ${mobile ? "py-2" : "transition-colors"}`}
        >
          {link.label}
        </button>
      ) : (
        <a
          href={link.to}
          className={
            mobile
              ? "relative py-2"
              : "font-nav transition-colors hover:text-accent"
          }
          onClick={onClick}
        >
          {link.label}
        </a>
      )}
      {isComingSoon && (
        <span
          aria-hidden="true"
          className={`pointer-events-none -mt-0.5 -rotate-6 whitespace-nowrap rounded-[5px] border-2 border-black bg-red-500 px-1.5 py-0.5 font-nav text-[8px] font-extrabold leading-none text-white shadow-[1px_2px_0_#000] ${mobile ? "text-[7px]" : "md:text-[9px]"}`}
        >
          PRÓXIMAMENTE
        </span>
      )}
    </span>
  );
}

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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-9 md:px-4 py-5 md:justify-center md:py-7">
        <a href="/" className="md:hidden" aria-label="Ir al inicio">
          <img
            src={logoSinergia.src}
            alt="Sinergia"
            className="h-5 w-auto max-w-full scale-[2.1] object-contain"
          />
        </a>

        <nav className="font-nav hidden w-full items-center justify-center gap-16 text-center text-2xl font-medium md:flex">
          {links.map((l) => (
            <NavLink key={l.to} link={l} />
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
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
          className="flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-md md:hidden"
        >
          <span
            aria-hidden="true"
            className={`block h-0.5 w-7 origin-center bg-primary-foreground transition-[transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${open ? "translate-y-2 rotate-45" : ""}`}
          />
          <span
            aria-hidden="true"
            className={`block h-0.5 w-7 bg-primary-foreground transition-[opacity] duration-150 ease-out motion-reduce:transition-none ${open ? "opacity-0" : ""}`}
          />
          <span
            aria-hidden="true"
            className={`block h-0.5 w-7 origin-center bg-primary-foreground transition-[transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${open ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </div>

      {open && (
        <nav
          id="mobile-menu"
          className="font-nav flex flex-col items-center gap-1 border-t border-primary-foreground/20 px-4 pb-4 text-center text-sm md:hidden"
        >
          {links.map((l) => (
            <NavLink
              key={l.to}
              link={l}
              mobile
              onClick={() => setOpen(false)}
            />
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
