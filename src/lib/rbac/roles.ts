export const Role = {
  PLATFORM_SUPER_ADMIN: "PLATFORM_SUPER_ADMIN",
  ORGANIZATION_OWNER: "ORGANIZATION_OWNER",
  CORPORATE_ADMIN: "CORPORATE_ADMIN",
  FINANCE_USER: "FINANCE_USER",
  REGIONAL_MANAGER: "REGIONAL_MANAGER",
  PROPERTY_MANAGER: "PROPERTY_MANAGER",
  DEPARTMENT_SUPERVISOR: "DEPARTMENT_SUPERVISOR",
  STAFFING_COMPANY_ADMIN: "STAFFING_COMPANY_ADMIN",
  STAFFING_COMPANY_COORDINATOR: "STAFFING_COMPANY_COORDINATOR",
  EMPLOYEE: "EMPLOYEE",
  READ_ONLY_AUDITOR: "READ_ONLY_AUDITOR",
} as const

export type Role = (typeof Role)[keyof typeof Role]

export const ROLES = Object.values(Role)

export const ROLE_LABELS: Record<Role, string> = {
  [Role.PLATFORM_SUPER_ADMIN]: "Platform Super Admin",
  [Role.ORGANIZATION_OWNER]: "Organization Owner",
  [Role.CORPORATE_ADMIN]: "Corporate Admin",
  [Role.FINANCE_USER]: "Finance User",
  [Role.REGIONAL_MANAGER]: "Regional Manager",
  [Role.PROPERTY_MANAGER]: "Property Manager",
  [Role.DEPARTMENT_SUPERVISOR]: "Department Supervisor",
  [Role.STAFFING_COMPANY_ADMIN]: "Staffing Company Admin",
  [Role.STAFFING_COMPANY_COORDINATOR]: "Staffing Company Coordinator",
  [Role.EMPLOYEE]: "Employee",
  [Role.READ_ONLY_AUDITOR]: "Read Only Auditor",
}
