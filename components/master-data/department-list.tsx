"use client"

import { DatabaseResourceList } from "@/components/master-data/database-resource-list"

function mapDepartment(value: Record<string, unknown>) {
  const property = value.property as { name: string }

  return {
    id: value.id as string,
    name: value.name as string,
    status: value.status as string,
    detail: value.code as string,
    parent: property.name,
  }
}

export function DepartmentList() {
  return (
    <DatabaseResourceList
      title="Departments"
      description="View department master records."
      endpoint="/api/departments"
      responseKey="departments"
      emptyMessage="No departments found. Create your first department."
      mapItem={mapDepartment}
    />
  )
}
