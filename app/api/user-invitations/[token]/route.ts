import { errorResponse } from "@/src/lib/http"
import { prisma } from "@/src/lib/prisma"
import { resolveClerkCurrentUser } from "@/src/lib/rbac/clerk-user"
import { acceptUserInvitationByToken } from "@/src/lib/users/invitations"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params
    const invitation = await prisma.userInvitation.findUnique({
      where: { token },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        invitedAt: true,
        expiresAt: true,
        organization: { select: { name: true } },
      },
    })
    if (!invitation) throw new Error("Invitation not found.")
    return Response.json({ invitation })
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
    const { token } = await params
    return Response.json(await acceptUserInvitationByToken(token, actor))
  } catch (error) {
    return errorResponse(error)
  }
}
