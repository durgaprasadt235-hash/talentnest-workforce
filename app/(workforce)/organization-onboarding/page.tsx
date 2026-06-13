import type { Metadata } from "next"

import { InvitedOrganizationSetup } from "@/components/master-data/invited-organization-setup"

export const metadata: Metadata = { title: "Organization setup" }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  return <InvitedOrganizationSetup token={(await searchParams).token} />
}
