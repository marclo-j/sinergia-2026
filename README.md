# Sinergia Vol. II — Sitio web de la conferencia

Sitio web para la conferencia Sinergia Vol. II (30-31 oct, 1 nov 2026). Construido con Astro 7 + React 19 islands + Tailwind 4 + Supabase.

## Comandos

| Comando | Acción |
|---------|--------|
| `npm run dev` | Servidor de desarrollo en `localhost:4321` |
| `npm run build` | Build de producción a `./dist/` |
| `npm run preview` | Preview del build local |

## Estructura

```
src/
├── assets/              # Imágenes optimizadas (astro:assets)
│   ├── hero/
│   ├── countdown/
│   ├── pilares/
│   └── sinergia/
├── components/
│   ├── islands/         # Componentes React (client-side)
│   │   ├── AdminPanel.tsx
│   │   ├── AuthForm.tsx
│   │   ├── Countdown.tsx
│   │   ├── InscripcionForm.tsx
│   │   ├── MerchStore.tsx
│   │   ├── MiEntrada.tsx
│   │   └── ProgramaTimeline.tsx
│   ├── sections/        # Secciones reutilizables de Astro
│   │   ├── Hero.astro
│   │   ├── CountdownSection.astro
│   │   ├── QueEsSinergia.astro
│   │   ├── TresDias.astro
│   │   ├── Pilares.astro
│   │   └── CtaSection.astro
│   ├── ui/              # Componentes base (patrón shadcn)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── textarea.tsx
│   │   └── sonner.tsx
│   ├── SiteHeader.tsx
│   └── SiteFooter.astro
├── hooks/
│   └── useAuth.ts
├── layouts/
│   └── Layout.astro
├── lib/
│   ├── constants.ts
│   ├── utils.ts
│   └── supabase/
│       ├── client.ts
│       └── types.ts
├── pages/
│   ├── index.astro
│   ├── admin.astro
│   ├── auth.astro
│   ├── inscripcion.astro
│   ├── merch.astro
│   ├── mi-entrada.astro
│   └── programa.astro
└── styles/
    └── global.css
```

## Stack

- **Framework:** Astro 7 con React islands
- **Estilos:** Tailwind CSS 4 + design tokens (global.css)
- **UI:** Radix UI + class-variance-authority (patrón shadcn)
- **Backend:** Supabase (auth + base de datos + storage)
- **Formularios:** Zod (validación)
- **Notificaciones:** Sonner (toasts)

## Variables de entorno

```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_PUBLISHABLE_KEY=
PUBLIC_SUPABASE_PROJECT_ID=
```
