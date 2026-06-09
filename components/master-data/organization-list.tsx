"use client"

import { DatabaseResourceList } from "@/components/master-data/database-resource-list"

export function OrganizationList() {
  return (
    <DatabaseResourceList kind="organization" />
  )
}
