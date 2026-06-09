import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { updateProperty } from "@/src/lib/master-data/service"
import { propertySchema } from "@/src/lib/master-data/validation"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Context) {
  try {
    requireServerPermission(request, Permission.MANAGE_PROPERTIES)
    const input = await parseJsonBody(request, propertySchema)
    return Response.json({ property: await updateProperty((await params).id, input) })
  } catch (error) {
    return errorResponse(error)
  }
}
