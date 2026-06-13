import { errorResponse } from "@/src/lib/http"
import { resendOrganizationInvitation } from "@/src/lib/organizations/onboarding"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; invitationId: string }> },
) {
  try {
    const actor = await requireServerPermission(request, Permission.MANAGE_ORGANIZATION)
    const { id, invitationId } = await params
    return Response.json(await resendOrganizationInvitation(id, invitationId, actor))
  } catch (error) {
    return errorResponse(error)
  }
}
