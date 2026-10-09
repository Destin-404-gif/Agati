import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/staff";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

/** Only allow same-origin relative redirects back into the admin. */
function safeNext(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/admin")) return "/admin";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const staff = await getCurrentStaff();
  if (staff) redirect("/admin");

  const { next } = await searchParams;
  return <LoginForm next={safeNext(next)} />;
}
