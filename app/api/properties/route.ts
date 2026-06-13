import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { createProperty, listProperties } from "@/src/lib/master-data/service"
import { propertySchema } from "@/src/lib/master-data/validation"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function GET(request: Request) {
  try {
    await requireServerPermission(request, Permission.VIEW_PROPERTIES)
    return Response.json(await listProperties())
  } catch (error) {
    return errorResponse(error, 500)
  }
}

export async function POST(request: Request) {
  try {
    await requireServerPermission(request, Permission.MANAGE_PROPERTIES)
    const input = await parseJsonBody(request, propertySchema)
    return Response.json({ property: await createProperty(input) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
