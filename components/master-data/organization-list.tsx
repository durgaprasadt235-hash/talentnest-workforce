"use client"

import { DatabaseResourceList } from "@/components/master-data/database-resource-list"
import { OrganizationOnboarding } from "@/components/master-data/organization-onboarding"

export function OrganizationList() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><OrganizationOnboarding /></div>
      <DatabaseResourceList kind="organization" />
    </div>
  )
}
