"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden className="shrink-0">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

export function LoginForm() {
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"ms" | "email" | null>(null);

  async function signInMicrosoft() {
    setError(null);
    setLoading("ms");
    const { error } = await authClient.signIn.social({
      provider: "microsoft",
      callbackURL: `${window.location.origin}/`,
    });
    if (error) {
      setError(error.message ?? "Microsoft sign-in failed.");
      setLoading(null);
    }
    // On success Better Auth redirects the browser to Microsoft.
  }

  async function signInEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("email");
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      setError(error.message ?? "Invalid email or password.");
      setLoading(null);
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Access is invitation-only.{" "}
          <Link
            href="/sign-up"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Need access?
          </Link>
        </p>
      </div>

      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full text-sm"
          onClick={signInMicrosoft}
          disabled={loading !== null}
        >
          {loading === "ms" ? <Loader2 className="animate-spin" /> : <MicrosoftIcon />}
          Continue with Microsoft
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          OR
          <span className="h-px flex-1 bg-border" />
        </div>

        {!showEmail ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full text-sm"
            onClick={() => setShowEmail(true)}
            disabled={loading !== null}
          >
            <Mail />
            Sign in with email
          </Button>
        ) : (
          <form onSubmit={signInEmail} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                className="h-11"
                placeholder="owner@mercadoahorros.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/reset"
                  className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
                >
                  Forgot?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="h-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="h-11 w-full" disabled={loading !== null}>
              {loading === "email" && <Loader2 className="animate-spin" />}
              Sign in
            </Button>
          </form>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Owner accounts sign in with email and password; everyone else continues with Microsoft
        using their invited address.
      </p>
    </div>
  );
}
