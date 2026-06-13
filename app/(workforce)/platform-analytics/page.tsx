import type { Metadata } from "next"

import { ResourcePage } from "@/components/shared/resource-page"

export const metadata: Metadata = { title: "Platform Analytics" }

export default function Page() {
  return <ResourcePage title="Platform Analytics" />
}
