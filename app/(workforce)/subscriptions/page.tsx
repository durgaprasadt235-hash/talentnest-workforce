import type { Metadata } from "next"

import { PlatformConsoleRoute } from "@/components/platform/platform-console-route"

export const metadata: Metadata = { title: "Subscriptions" }

export default function Page() {
  return <PlatformConsoleRoute moduleKey="subscriptions" />
}
