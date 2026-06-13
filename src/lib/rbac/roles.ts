export const Role = {
  PLATFORM_OWNER: "PLATFORM_OWNER",
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
  ORGANIZATION_OWNER: "ORGANIZATION_OWNER",
  CORPORATE_ADMIN: "CORPORATE_ADMIN",
  FINANCE_USER: "FINANCE_USER",
  PROPERTY_MANAGER: "PROPERTY_MANAGER",
  STAFFING_ADMIN: "STAFFING_ADMIN",
  STAFFING_BILLING: "STAFFING_BILLING",
  EMPLOYEE: "EMPLOYEE",
} as const

export type Role = (typeof Role)[keyof typeof Role]

export const ROLES = Object.values(Role)

export const ROLE_LABELS: Record<Role, string> = {
  [Role.PLATFORM_OWNER]: "Platform Owner",
  [Role.PLATFORM_ADMIN]: "Platform Admin",
  [Role.ORGANIZATION_OWNER]: "Organization Owner",
  [Role.CORPORATE_ADMIN]: "Corporate Admin",
  [Role.FINANCE_USER]: "Finance User",
  [Role.PROPERTY_MANAGER]: "Property Manager",
  [Role.STAFFING_ADMIN]: "Staffing Admin",
  [Role.STAFFING_BILLING]: "Staffing Billing",
  [Role.EMPLOYEE]: "Employee",
}
