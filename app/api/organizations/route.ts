import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { createOrganization, listOrganizations } from "@/src/lib/master-data/service"
import { organizationSchema } from "@/src/lib/master-data/validation"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function GET(request: Request) {
  try {
    const actor = await requireServerPermission(request, Permission.VIEW_ORGANIZATION)
    return Response.json({ organizations: await listOrganizations(actor) })
  } catch (error) {
    return errorResponse(error, 500)
  }
}

export async function POST(request: Request) {
  try {
    await requireServerPermission(request, Permission.MANAGE_ORGANIZATION)
    const input = await parseJsonBody(request, organizationSchema)
    return Response.json({ organization: await createOrganization(input) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
