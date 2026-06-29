# MercadoAhorrosCRM

Office-staff web CRM for Mercado Ahorros. Next.js (App Router) + TypeScript + Tailwind +
shadcn/ui. Authenticates against the Better Auth service and consumes the .NET API.

## Architecture (BFF)

The browser only ever talks to this app. This app's **server** holds the session and talks
to the backend, so the API JWT never reaches the browser:

- **Sign-in** happens in the browser against the auth service: **Microsoft** (primary, for
  staff) or **email + password** (the Owner local account, behind a link). Better Auth sets
  its session cookie, shared with this app (same host in dev; shared parent domain in prod).
- **Data access** is server-side only. For each request the server reads the incoming
  session cookie, mints a short-lived ES256 JWT from the auth service (`/api/auth/token`),
  and calls the .NET API with `Authorization: Bearer …` (`src/lib/server/*`).
- **Route protection**: `src/proxy.ts` redirects unauthenticated requests to `/login`; the
  authenticated layout (`src/app/(app)/layout.tsx`) validates the session server-side and
  loads `/api/me/permissions` for UI gating (`Can`, `usePermissions`). The API still
  enforces every permission.

## Auth policy

- **Invitation-only.** This UI offers no open sign-up. Enforcing it (rejecting un-invited
  Microsoft sign-ins, disabling public email sign-up) is an **auth-service** change. Staff
  use Microsoft; the Owner is a local account.

## Run (dev)

Requires the auth service + .NET API reachable (e.g. the API repo's `integration/` docker
stack: auth on `:8088`, API on `:8080`).

```bash
cp .env.example .env.local   # adjust URLs if needed
pnpm install
pnpm dev                     # http://localhost:3000
```

## Structure

- `src/lib/server/auth.ts` — session + JWT via cookie forwarding (server only).
- `src/lib/server/api.ts` — BFF fetch (attaches the Bearer JWT; memoized per request).
- `src/lib/auth-client.ts` — browser Better Auth client (sign-in / sign-out only).
- `src/app/login/` — Microsoft-primary login; owner email/password behind a link.
- `src/app/(app)/` — authenticated shell, dashboard, customers list + create.

> Note: this project targets a recent Next.js with breaking changes (see `AGENTS.md`):
> the request-interception file is `proxy.ts` (not `middleware.ts`), UI primitives are
> Base UI (use `render`/`buttonVariants`, not `asChild`), and `headers()`/`searchParams`
> are async.
