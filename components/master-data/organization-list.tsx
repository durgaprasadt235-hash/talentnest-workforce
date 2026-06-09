"use client"

import { DatabaseResourceList } from "@/components/master-data/database-resource-list"

function mapOrganization(value: Record<string, unknown>) {
  return {
    id: value.id as string,
    name: value.name as string,
    status: value.status as string,
    detail: value.slug as string,
  }
}

export function OrganizationList() {
  return (
    <DatabaseResourceList
      title="Organizations"
      description="View organization master records."
      endpoint="/api/organizations"
      responseKey="organizations"
      emptyMessage="No organizations found. Create your first organization."
      mapItem={mapOrganization}
    />
  )
}
