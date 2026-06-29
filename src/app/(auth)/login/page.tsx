import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  // Validate the session for real (not just cookie presence). This is what prevents a
  // stale/expired session cookie from ping-ponging between the proxy and the app layout:
  // an invalid cookie falls through to the login form instead of being bounced home.
  const cookie = (await headers()).get("cookie");
  const user = await getSession(cookie);
  if (user) {
    redirect("/");
  }
  return <LoginForm />;
}
