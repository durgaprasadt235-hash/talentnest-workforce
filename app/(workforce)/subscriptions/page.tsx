import type { Metadata } from "next"

import { ResourcePage } from "@/components/shared/resource-page"

export const metadata: Metadata = { title: "Subscriptions" }

export default function Page() {
  return <ResourcePage title="Subscriptions" />
}
