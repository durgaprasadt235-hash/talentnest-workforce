import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { updateOrganizationFeatureOverride } from "@/src/lib/organizations/onboarding"
import { organizationFeatureOverrideSchema } from "@/src/lib/organizations/validation"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireServerPermission(request, Permission.MANAGE_ORGANIZATION)
    const input = await parseJsonBody(request, organizationFeatureOverrideSchema)
    return Response.json({
      featureOverride: await updateOrganizationFeatureOverride((await params).id, input, actor),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
