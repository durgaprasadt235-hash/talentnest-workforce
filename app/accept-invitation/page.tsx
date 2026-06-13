import type { Metadata } from "next"

import { InvitationDetails } from "@/components/master-data/invitation-details"

export const metadata: Metadata = { title: "Accept invitation" }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const token = (await searchParams).token
  if (!token) {
    return <main className="mx-auto max-w-2xl px-6 py-12"><h1 className="text-2xl font-semibold">Invitation token required</h1><p className="mt-2 text-sm text-muted-foreground">Open the complete invitation link provided by your TalentNest administrator.</p></main>
  }
  return <InvitationDetails token={token} />
}
