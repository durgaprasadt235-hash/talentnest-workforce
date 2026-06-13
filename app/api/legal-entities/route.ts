import { createLegalEntity, listLegalEntities } from "@/src/lib/legal-entities/service"
import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { legalEntitySchema } from "@/src/lib/master-data/validation"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function GET(request: Request) {
  try {
    const user = await requireServerPermission(request, Permission.VIEW_LEGAL_ENTITIES)
    return Response.json(await listLegalEntities(user))
  } catch (error) {
    return errorResponse(error, 500)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_LEGAL_ENTITIES)
    const input = await parseJsonBody(request, legalEntitySchema)
    return Response.json({ legalEntity: await createLegalEntity(input, user) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
