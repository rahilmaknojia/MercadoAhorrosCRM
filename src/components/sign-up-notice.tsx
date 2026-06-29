"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Loader2, MailCheck } from "lucide-react";

const GENERIC_ERROR =
  "We couldn't sign you in right now. Please try again, or contact support if the problem continues.";

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

export function SignUpNotice() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function continueWithMicrosoft() {
    setError(null);
    setLoading(true);
    try {
      const { error } = await authClient.signIn.social({
        provider: "microsoft",
        callbackURL: `${window.location.origin}/`,
      });
      // On success the browser redirects to Microsoft. Otherwise reset the button.
      if (error) {
        setError(GENERIC_ERROR);
        setLoading(false);
      }
    } catch {
      // A thrown error (request never reaches the auth service) isn't returned as
      // { error }; catch it so the button never gets stuck spinning.
      setError(GENERIC_ERROR);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <MailCheck className="mx-auto h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Invitation only</h1>
          <p className="text-sm text-muted-foreground">
            Mercado Ahorros accounts are created by invitation. If your email has been invited,
            continue with Microsoft to finish setting up your account.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full"
          onClick={continueWithMicrosoft}
          disabled={loading}
        >
          {loading ? <Loader2 className="animate-spin" /> : <MicrosoftIcon />}
          Continue with Microsoft
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Haven&apos;t been invited yet? Contact your Mercado Ahorros administrator.
      </p>
      <p className="text-center text-sm">
        <Link href="/login" className="text-muted-foreground underline-offset-4 hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
