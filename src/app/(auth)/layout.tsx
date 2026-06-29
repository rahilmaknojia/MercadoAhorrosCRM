import Image from "next/image";

// Shared shell for the public auth pages (login, reset, sign-up). A dark brand panel
// showcases the (black-field) Mercado Ahorros logo; the form sits on a clean light panel.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Brand panel (desktop) */}
      <div className="dark relative hidden flex-col justify-between bg-zinc-950 p-10 text-zinc-100 lg:flex">
        <Image
          src="/Mercado-Logo.png"
          alt="Mercado Ahorros"
          width={1027}
          height={562}
          priority
          className="h-12 w-auto"
        />
        <div className="space-y-3">
          <p className="text-2xl font-medium leading-snug text-balance">
            Customer relationship management for Mercado Ahorros member stores.
          </p>
          <p className="text-sm text-zinc-400">
            Secure, invitation-only access for the Mercado Ahorros team.
          </p>
        </div>
        <p className="text-xs text-zinc-500">
          © {new Date().getFullYear()} Mercado Ahorros
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
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
