import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { inviteUser, listUserInvitations } from "@/src/lib/users/invitations"
import { invitationInputSchema } from "@/src/lib/users/validation"

export async function GET(request: Request) {
  try {
    const actor = await requireServerPermission(request, Permission.VIEW_USERS)
    return Response.json({ invitations: await listUserInvitations(actor) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireServerPermission(request, Permission.MANAGE_USERS)
    const input = await parseJsonBody(request, invitationInputSchema)
    return Response.json(await inviteUser(input, actor), { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
