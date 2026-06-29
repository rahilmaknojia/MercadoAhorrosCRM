import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/auth";
import { SignUpNotice } from "@/components/sign-up-notice";

export default async function SignUpPage() {
  const cookie = (await headers()).get("cookie");
  const user = await getSession(cookie);
  if (user) {
    redirect("/");
  }
  return <SignUpNotice />;
}
