import type { Metadata } from "next"

import { ResourcePage } from "@/components/shared/resource-page"

export const metadata: Metadata = { title: "Dashboard" }

export default function Page() {
  return <ResourcePage title="Dashboard" />
}
