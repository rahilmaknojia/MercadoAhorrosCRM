"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2 } from "lucide-react";

export function ResetPasswordForm({ token }: { token?: string }) {
  const router = useRouter();
  // With a token (from the email link) we set a new password; otherwise we request one.
  return token ? <SetNewPassword token={token} onDone={() => router.push("/login")} /> : <RequestReset />;
}

function RequestReset() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Fire-and-forget; we always show the same neutral message to avoid revealing
    // which emails have accounts.
    await authClient
      .requestPasswordReset({ email, redirectTo: "/reset" })
      .catch(() => undefined);
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            If an account exists for <span className="font-medium">{email}</span>, we&apos;ve sent a
            link to reset your password.
          </p>
        </div>
        <Link
          href="/login"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
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
        <Button
          type="submit"
          className="h-10 w-full bg-brand text-brand-foreground hover:bg-brand/90"
          disabled={loading}
        >
          {loading && <Loader2 className="animate-spin" />}
          Send reset link
        </Button>
      </form>
      <p className="text-center text-sm">
        <Link href="/login" className="text-muted-foreground underline-offset-4 hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}

function SetNewPassword({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);
    if (error) {
      setError(error.message ?? "This reset link is invalid or has expired.");
      return;
    }
    onDone();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="text-sm text-muted-foreground">Choose a new password for your account.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          className="h-10 w-full bg-brand text-brand-foreground hover:bg-brand/90"
          disabled={loading}
        >
          {loading && <Loader2 className="animate-spin" />}
          Update password
        </Button>
      </form>
    </div>
  );
}
