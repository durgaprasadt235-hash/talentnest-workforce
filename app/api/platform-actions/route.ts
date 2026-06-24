import { z } from "zod"

import { createAuditLog } from "@/src/lib/audit"
import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

const platformActionSchema = z.object({
  action: z.string().trim().min(3).max(120),
  entityType: z.string().trim().min(1).max(120),
  entityId: z.string().trim().min(1).max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: Request) {
  try {
    const actor = await requireServerPermission(request, Permission.VIEW_PLATFORM_DASHBOARD)
    const input = await parseJsonBody(request, platformActionSchema)

    const auditLog = await createAuditLog({
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      userId: actor.id,
      auditType: "PLATFORM",
      metadata: input.metadata,
    })

    return Response.json({ auditLogId: auditLog.id })
  } catch (error) {
    return errorResponse(error)
  }
}
