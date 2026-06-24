import { Prisma } from "@prisma/client"

import { prisma } from "@/src/lib/prisma"
import {
  ROLE_PERMISSIONS,
  type Permission,
} from "@/src/lib/rbac/permissions"
import { ROLES, type Role } from "@/src/lib/rbac/roles"

export type PermissionAction =
  | "canView"
  | "canCreate"
  | "canEdit"
  | "canDelete"
  | "canApprove"
  | "canExport"

export type RolePermissionInput = {
  role: Role
  module: string
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canApprove: boolean
  canExport: boolean
}

const permissionModuleMap: Record<Permission, { module: string; action: PermissionAction }> = {
  VIEW_PLATFORM_DASHBOARD: { module: "PLATFORM_DASHBOARD", action: "canView" },
  VIEW_PLATFORM_CLIENTS: { module: "PLATFORM_CLIENTS", action: "canView" },
  MANAGE_PLATFORM_CLIENTS: { module: "PLATFORM_CLIENTS", action: "canEdit" },
  VIEW_PLATFORM_ONBOARDING: { module: "PLATFORM_ONBOARDING", action: "canView" },
  MANAGE_PLATFORM_ONBOARDING: { module: "PLATFORM_ONBOARDING", action: "canEdit" },
  VIEW_PLATFORM_SUBSCRIPTIONS: { module: "PLATFORM_SUBSCRIPTIONS", action: "canView" },
  MANAGE_PLATFORM_SUBSCRIPTIONS: { module: "PLATFORM_SUBSCRIPTIONS", action: "canEdit" },
  VIEW_PLATFORM_BILLING: { module: "PLATFORM_BILLING", action: "canView" },
  MANAGE_PLATFORM_BILLING: { module: "PLATFORM_BILLING", action: "canEdit" },
  VIEW_PLATFORM_KIOSKS: { module: "PLATFORM_KIOSKS", action: "canView" },
  MANAGE_PLATFORM_KIOSKS: { module: "PLATFORM_KIOSKS", action: "canEdit" },
  VIEW_PLATFORM_SUPPORT: { module: "PLATFORM_SUPPORT", action: "canView" },
  MANAGE_PLATFORM_SUPPORT: { module: "PLATFORM_SUPPORT", action: "canEdit" },
  VIEW_PLATFORM_SECURITY: { module: "PLATFORM_SECURITY", action: "canView" },
  MANAGE_PLATFORM_SECURITY: { module: "PLATFORM_SECURITY", action: "canEdit" },
  VIEW_PLATFORM_COMPLIANCE: { module: "PLATFORM_COMPLIANCE", action: "canView" },
  MANAGE_PLATFORM_COMPLIANCE: { module: "PLATFORM_COMPLIANCE", action: "canEdit" },
  VIEW_PLATFORM_ANALYTICS: { module: "PLATFORM_ANALYTICS", action: "canView" },
  MANAGE_PLATFORM_ANALYTICS: { module: "PLATFORM_ANALYTICS", action: "canEdit" },
  VIEW_PLATFORM_INTERNAL_TEAMS: { module: "PLATFORM_INTERNAL_TEAMS", action: "canView" },
  MANAGE_PLATFORM_INTERNAL_TEAMS: { module: "PLATFORM_INTERNAL_TEAMS", action: "canEdit" },
  VIEW_PLATFORM_SETTINGS: { module: "PLATFORM_SETTINGS", action: "canView" },
  MANAGE_PLATFORM_SETTINGS: { module: "PLATFORM_SETTINGS", action: "canEdit" },
  VIEW_PLATFORM_AUDIT_LOGS: { module: "PLATFORM_AUDIT_LOGS", action: "canView" },
  VIEW_ORGANIZATION: { module: "ORGANIZATIONS", action: "canView" },
  MANAGE_ORGANIZATION: { module: "ORGANIZATIONS", action: "canEdit" },
  VIEW_PROPERTIES: { module: "PROPERTIES", action: "canView" },
  MANAGE_PROPERTIES: { module: "PROPERTIES", action: "canEdit" },
  VIEW_LEGAL_ENTITIES: { module: "LEGAL_ENTITIES", action: "canView" },
  MANAGE_LEGAL_ENTITIES: { module: "LEGAL_ENTITIES", action: "canEdit" },
  VIEW_DEPARTMENTS: { module: "DEPARTMENTS", action: "canView" },
  MANAGE_DEPARTMENTS: { module: "DEPARTMENTS", action: "canEdit" },
  VIEW_EMPLOYEES: { module: "EMPLOYEES", action: "canView" },
  MANAGE_EMPLOYEES: { module: "EMPLOYEES", action: "canEdit" },
  VIEW_STAFFING_COMPANIES: { module: "STAFFING", action: "canView" },
  MANAGE_STAFFING_COMPANIES: { module: "STAFFING", action: "canEdit" },
  VIEW_SCHEDULES: { module: "SCHEDULING", action: "canView" },
  MANAGE_SCHEDULES: { module: "SCHEDULING", action: "canEdit" },
  VIEW_ATTENDANCE: { module: "ATTENDANCE", action: "canView" },
  MANAGE_ATTENDANCE: { module: "ATTENDANCE", action: "canEdit" },
  APPROVE_ATTENDANCE: { module: "ATTENDANCE", action: "canApprove" },
  VIEW_DEVICES: { module: "DEVICES", action: "canView" },
  MANAGE_DEVICES: { module: "DEVICES", action: "canEdit" },
  VIEW_WEEKLY_ATTENDANCE: { module: "WEEKLY_ATTENDANCE", action: "canView" },
  GENERATE_WEEKLY_ATTENDANCE: { module: "WEEKLY_ATTENDANCE", action: "canCreate" },
  APPROVE_WEEKLY_ATTENDANCE: { module: "WEEKLY_ATTENDANCE", action: "canApprove" },
  LOCK_WEEKLY_ATTENDANCE: { module: "WEEKLY_ATTENDANCE", action: "canApprove" },
  MANAGE_CORPORATE_WEEKLY_ATTENDANCE: { module: "WEEKLY_ATTENDANCE", action: "canEdit" },
  SEND_WEEKLY_ATTENDANCE_TO_CORPORATE: { module: "WEEKLY_ATTENDANCE", action: "canApprove" },
  SEND_WEEKLY_ATTENDANCE_TO_FINANCE: { module: "WEEKLY_ATTENDANCE", action: "canApprove" },
  MANAGE_WEEKLY_ATTENDANCE_PAYABLES: { module: "WEEKLY_ATTENDANCE", action: "canEdit" },
  VIEW_TIMESHEETS: { module: "TIMESHEETS", action: "canView" },
  APPROVE_TIMESHEETS: { module: "TIMESHEETS", action: "canApprove" },
  VIEW_INVOICES: { module: "INVOICES", action: "canView" },
  MANAGE_INVOICES: { module: "INVOICES", action: "canEdit" },
  APPROVE_INVOICES: { module: "INVOICES", action: "canApprove" },
  VIEW_PAYMENTS: { module: "PAYMENTS", action: "canView" },
  APPROVE_PAYMENTS: { module: "PAYMENTS", action: "canApprove" },
  VIEW_USERS: { module: "USERS", action: "canView" },
  MANAGE_USERS: { module: "USERS", action: "canEdit" },
  VIEW_AUDIT_LOGS: { module: "AUDIT_LOGS", action: "canView" },
}

export const permissionModules = [...new Set(Object.values(permissionModuleMap).map((value) => value.module))].sort()

export function permissionToModuleAction(permission: Permission) {
  return permissionModuleMap[permission]
}

export async function listRolePermissions() {
  await ensureRolePermissionsSeeded()
  return prisma.rolePermission.findMany({
    orderBy: [{ role: "asc" }, { module: "asc" }],
  })
}

export async function updateRolePermission(input: RolePermissionInput) {
  return prisma.rolePermission.upsert({
    where: { role_module: { role: input.role, module: input.module } },
    create: input,
    update: input,
  })
}

export async function listEffectivePermissions(role: Role): Promise<Permission[]> {
  await ensureRolePermissionsSeeded()
  const rows = await prisma.rolePermission.findMany({ where: { role } })

  if (!rows.length) return [...ROLE_PERMISSIONS[role]]

  return Object.entries(permissionModuleMap)
    .filter(([, target]) => {
      const row = rows.find((candidate) => candidate.module === target.module)
      return Boolean(row?.[target.action])
    })
    .map(([permission]) => permission as Permission)
}

let seeded = false

async function ensureRolePermissionsSeeded() {
  if (seeded) return

  await prisma.$transaction(
    defaultRolePermissionRows().map((row) =>
      prisma.rolePermission.upsert({
        where: { role_module: { role: row.role, module: row.module } },
        create: row,
        update: row,
      }),
    ),
  )
  seeded = true
}

function defaultRolePermissionRows(): Prisma.RolePermissionCreateInput[] {
  return ROLES.flatMap((role) => {
    const permissions = ROLE_PERMISSIONS[role]
    return permissionModules.map((module) => {
      const row = {
        role,
        module,
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canApprove: false,
        canExport: false,
      }

      for (const permission of permissions) {
        const target = permissionModuleMap[permission]
        if (target.module === module) row[target.action] = true
      }

      return row
    })
  })
}
