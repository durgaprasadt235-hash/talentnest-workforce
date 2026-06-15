import { errorResponse } from "@/src/lib/http"
import { prisma } from "@/src/lib/prisma"
import { resolveClerkCurrentUser } from "@/src/lib/rbac/clerk-user"

export async function POST() {
  try {
    const user = await resolveClerkCurrentUser()
    if (!user.id) throw new Error("User not found.")

    await prisma.user.update({
      where: { id: user.id },
      data: { mustChangePassword: false, temporaryPassword: null },
    })
    return Response.json({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
