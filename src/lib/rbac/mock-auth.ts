import type { Role } from "@/src/lib/rbac/roles"

export const MOCK_ROLE_HEADER = "x-talentnest-mock-role"
export const MOCK_ORGANIZATION_HEADER = "x-talentnest-mock-organization-id"
export const MOCK_PROPERTY_IDS_HEADER = "x-talentnest-mock-property-ids"
export const MOCK_STAFFING_COMPANY_HEADER = "x-talentnest-mock-staffing-company-id"

export function mockRoleHeaders(
  role: Role,
  context?: {
    organizationId?: string
    propertyIds?: string[]
    staffingCompanyId?: string
  },
) {
  const headers: Record<string, string> = { [MOCK_ROLE_HEADER]: role }
  if (context?.organizationId) {
    headers[MOCK_ORGANIZATION_HEADER] = context.organizationId
  }
  if (context?.propertyIds?.length) {
    headers[MOCK_PROPERTY_IDS_HEADER] = JSON.stringify(context.propertyIds)
  }
  if (context?.staffingCompanyId) {
    headers[MOCK_STAFFING_COMPANY_HEADER] = context.staffingCompanyId
  }
  return headers
}
