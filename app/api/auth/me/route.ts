import { errorResponse } from "@/src/lib/http"
import { resolveClerkCurrentUser } from "@/src/lib/rbac/clerk-user"

export async function GET() {
  try {
    const user = await resolveClerkCurrentUser()

    return Response.json({
      ...user,
      organizationId: user.organizationId ?? null,
      staffingCompanyId: user.staffingCompanyId ?? null,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
