import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/staff";
import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

/**
 * Optional, self-service password change.
 *
 * Nothing links here on a schedule and no code redirects to it: the seeded
 * password simply keeps working. A person who wants to move off it opens the
 * page from the account menu in the dashboard shell.
 */
export default async function ChangePasswordPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/admin/login?next=/admin/change-password");

  return <ChangePasswordForm handle={staff.username || staff.email} />;
}