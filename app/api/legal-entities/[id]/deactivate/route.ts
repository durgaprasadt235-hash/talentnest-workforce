import { RecordStatus } from "@prisma/client"

import { setLegalEntityStatus } from "@/src/lib/legal-entities/service"
import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_LEGAL_ENTITIES)
    return Response.json({ legalEntity: await setLegalEntityStatus((await params).id, RecordStatus.INACTIVE, user) })
  } catch (error) {
    return errorResponse(error)
  }
}
