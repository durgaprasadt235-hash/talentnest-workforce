import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { onboardOrganization } from "@/src/lib/organizations/onboarding"
import { organizationOnboardingSchema } from "@/src/lib/organizations/validation"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function POST(request: Request) {
  try {
    const actor = await requireServerPermission(request, Permission.MANAGE_ORGANIZATION)
    const input = await parseJsonBody(request, organizationOnboardingSchema)
    return Response.json(await onboardOrganization(input, actor), { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
