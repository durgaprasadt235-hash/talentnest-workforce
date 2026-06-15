import { AuditType, Prisma } from "@prisma/client"

import { prisma } from "@/src/lib/prisma"

export async function createAuditLog(input: {
  action: string
  entityType: string
  entityId?: string
  organizationId?: string
  propertyId?: string
  departmentId?: string
  employeeId?: string
  userId?: string
  auditType?: AuditType
  metadata?: Record<string, unknown>
}) {
  return prisma.auditLog.create({
    data: {
      ...input,
      auditType:
        input.auditType ??
        (input.entityType === "Organization" ||
        input.entityType === "OrganizationSubscription" ||
        input.entityType === "OrganizationFeatureOverride" ||
        input.entityType === "PlatformConfiguration" ||
        input.entityType === "StripeEvent" ||
        (input.entityType === "User" && !input.organizationId)
          ? AuditType.PLATFORM
          : AuditType.ORGANIZATION),
      employeeId:
        input.employeeId ??
        (input.entityType === "Employee" ? input.entityId : undefined),
      departmentId:
        input.departmentId ??
        (input.entityType === "Department" ? input.entityId : undefined),
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  })
}
