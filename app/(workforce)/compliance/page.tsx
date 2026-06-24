import type { Metadata } from "next"
import { PlatformConsoleRoute } from "@/components/platform/platform-console-route"
export const metadata: Metadata = { title: "Compliance" }
export default function Page() { return <PlatformConsoleRoute moduleKey="compliance" /> }
