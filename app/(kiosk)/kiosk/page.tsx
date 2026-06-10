import type { Metadata } from "next"

import { KioskClock } from "@/components/attendance/kiosk-clock"

export const metadata: Metadata = { title: "Attendance Kiosk" }

export default function Page() {
  return <KioskClock />
}
