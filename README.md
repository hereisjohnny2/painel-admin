# Painel Admin

A modular admin panel template for micro-SaaS products, built with Next.js (App Router), React and TypeScript.

This repository is a **live demo**: there is no login, no backend and no environment variables. All data is fictional and lives in memory in the browser, so anyone can open the app and try every feature. Reloading the page resets the data.

## Modules

- **Contas** (bills): monthly bills with categories, status (open / paid / overdue), monthly totals, duplicating a month, attaching a boleto and a payment receipt (PDF or image) and joining both into a single PDF, and importing bills from an `.xlsx` spreadsheet (one sheet per month).
- **Inventário** (inventory): items with per-category codes, quick +/- stock changes, minimum stock alerts and CSV export.

Modules can be turned on and off in **Configurações**; the choice is saved in the browser.

Other features: light/dark theme, collapsible sidebar (drawer on mobile) and toast notifications. All UI text is in Portuguese (pt-BR).

## Running

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Unit and component tests (Vitest + Testing Library) |

Deploying to Vercel (or any Next.js host) needs no configuration.

## Project structure

```
src/
  app/                 pages (one folder per module) and global styles
  components/          layout (sidebar, header, logo) and module components
  lib/
    api.ts             data layer: in-memory mock data used by every page
    modules.ts         module registry (name, route, description, on/off)
    contasCompute.ts   pure helpers for bills (totals, file names...)
    contasPlanilha.ts  .xlsx import for bills
    contasPdf.ts       PDF assembly (pdf-lib)
    inventario.ts      pure helpers for the inventory
    notify.ts          toast helper
tests/                 Vitest tests
```

## Making it yours

- **Name and logo:** `APP_NAME` and the SVG mark in `src/components/AppLogo.tsx`, the page title in `src/app/layout.tsx`, and the icons `src/app/favicon.ico`, `icon.png` and `apple-icon.png`.
- **Colors:** the theme tokens at the top of `src/app/globals.css` (`--brand`, `--accent`, `--header-bg`...), defined for light and dark mode.
- **Mock data:** the seed lists at the top of `src/lib/api.ts`.
- **A real backend:** components only talk to `src/lib/api.ts`. Replace the body of its functions with calls to your API (or a client such as Supabase), keeping the same signatures, and add authentication around the app layout.
- **A new module:** add it to `APP_MODULES` in `src/lib/modules.ts`, an icon in `src/components/ModuleIcon.tsx`, a page in `src/app/<slug>/page.tsx` wrapped in `<AppShell moduleName="<slug>">`, and its data functions in `src/lib/api.ts`.
