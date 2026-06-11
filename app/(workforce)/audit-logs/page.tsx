import type { Metadata } from "next"
import AuditLogsPage from "@/app/audit-logs/client"

export const metadata: Metadata = { title: "Audit Logs" }

export default function Page() {
  return <AuditLogsPage />
}
