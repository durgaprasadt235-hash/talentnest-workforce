import type { Metadata } from "next"
import { UserAccessManagement } from "@/components/users/user-access-management"

export const metadata: Metadata = { title: "Users & Access" }
export default function Page() {
  return <UserAccessManagement />
}
