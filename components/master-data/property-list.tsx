"use client"

import { DatabaseResourceList } from "@/components/master-data/database-resource-list"

function mapProperty(value: Record<string, unknown>) {
  const organization = value.organization as { name: string }
  const location = [value.city, value.state].filter(Boolean).join(", ")

  return {
    id: value.id as string,
    name: value.name as string,
    status: value.status as string,
    detail: [value.code, location].filter(Boolean).join(" · "),
    parent: organization.name,
  }
}

export function PropertyList() {
  return (
    <DatabaseResourceList
      title="Properties"
      description="View property master records."
      endpoint="/api/properties"
      responseKey="properties"
      emptyMessage="No properties found. Create your first property."
      mapItem={mapProperty}
    />
  )
}
