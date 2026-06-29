"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

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

export default function LoginPage() {
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
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">Mercado Ahorros CRM</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={signInMicrosoft}
            disabled={loading !== null}
          >
            {loading === "ms" ? <Loader2 className="animate-spin" /> : <MicrosoftIcon />}
            Continue with Microsoft
          </Button>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {!showEmail ? (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowEmail(true)}
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Sign in with email (owner account)
              </button>
            </div>
          ) : (
            <form onSubmit={signInEmail} className="space-y-3">
              <div className="relative py-1">
                <Separator />
                <span className="absolute inset-0 -top-2 mx-auto w-fit bg-card px-2 text-xs text-muted-foreground">
                  owner account
                </span>
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading !== null}>
                {loading === "email" && <Loader2 className="animate-spin" />}
                Sign in
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
