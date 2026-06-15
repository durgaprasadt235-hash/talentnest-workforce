import type { Metadata } from "next"

import { ChangePasswordForm } from "@/components/rbac/change-password-form"

export const metadata: Metadata = { title: "Change Password" }

export default function Page() {
  return <ChangePasswordForm />
}
