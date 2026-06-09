import { Prisma } from "@prisma/client"

import { prisma } from "@/src/lib/prisma"

export async function createAuditLog(input: {
  action: string
  entityType: string
  entityId?: string
  organizationId?: string
  propertyId?: string
  userId?: string
  metadata?: Record<string, unknown>
}) {
  return prisma.auditLog.create({
    data: {
      ...input,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  })
}
