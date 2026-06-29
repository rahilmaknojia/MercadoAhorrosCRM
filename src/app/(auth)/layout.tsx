import Image from "next/image";
import { Check } from "lucide-react";

const FEATURES = ["Invitation only", "Role-based access", "Audit logs"];

// Shared shell for the public auth pages (login, reset, sign-up). A textured dark
// brand panel showcases the (black-field) Mercado Ahorros logo; the form sits on a
// clean light panel to the right.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel (desktop) */}
      <div className="dark relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-zinc-100 lg:flex xl:p-14">
        {/* Subtle grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.6]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at 30% 20%, black, transparent 75%)",
          }}
        />
        {/* Accent glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-32 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl"
        />

        <Image
          src="/Mercado-Logo.png"
          alt="Mercado Ahorros"
          width={1027}
          height={562}
          priority
          className="relative h-11 w-auto self-start"
        />

        <div className="relative space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-medium tracking-wide text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            MERCADO AHORROS CRM
          </span>
          <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight text-balance xl:text-5xl">
            Everything for your{" "}
            <span className="text-emerald-400">member stores</span>.
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-zinc-400">
            Customers, vendors, reports, and team access — secured and audited, all in one place.
          </p>
        </div>

        <div className="relative flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          {FEATURES.map((f) => (
            <span key={f} className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo for mobile (no brand panel) */}
          <div className="flex justify-center lg:hidden">
            <div className="rounded-xl bg-zinc-950 px-5 py-4">
              <Image
                src="/Mercado-Logo.png"
                alt="Mercado Ahorros"
                width={1027}
                height={562}
                priority
                className="h-10 w-auto"
              />
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
