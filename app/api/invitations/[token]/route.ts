import { errorResponse } from "@/src/lib/http"
import { getInvitationByToken } from "@/src/lib/organizations/onboarding"

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
