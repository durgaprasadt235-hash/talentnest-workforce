import { errorResponse } from "@/src/lib/http"
import { acceptInvitationByToken, getInvitationByToken } from "@/src/lib/organizations/onboarding"
import { resolveClerkCurrentUser } from "@/src/lib/rbac/clerk-user"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    return Response.json({ invitation: await getInvitationByToken((await params).token) })
  } catch (error) {
    return errorResponse(error, 404)
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const actor = await resolveClerkCurrentUser()
    return Response.json(await acceptInvitationByToken((await params).token, actor))
  } catch (error) {
    return errorResponse(error)
  }
}
