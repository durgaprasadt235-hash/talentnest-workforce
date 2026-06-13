import { updateLegalEntity } from "@/src/lib/legal-entities/service"
import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { legalEntitySchema } from "@/src/lib/master-data/validation"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_LEGAL_ENTITIES)
    const input = await parseJsonBody(request, legalEntitySchema)
    return Response.json({ legalEntity: await updateLegalEntity((await params).id, input, user) })
  } catch (error) {
    return errorResponse(error)
  }
}
