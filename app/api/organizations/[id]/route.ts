import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { updateOrganization } from "@/src/lib/master-data/service"
import { organizationSchema } from "@/src/lib/master-data/validation"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Context) {
  try {
    await requireServerPermission(request, Permission.MANAGE_ORGANIZATION)
    const input = await parseJsonBody(request, organizationSchema)
    return Response.json({ organization: await updateOrganization((await params).id, input) })
  } catch (error) {
    return errorResponse(error)
  }
}
