import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { createUser, listUsersAndAccess } from "@/src/lib/users/service"
import { userInputSchema } from "@/src/lib/users/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"

export async function GET(request: Request) {
  try {
    const user = await requireServerPermission(request, Permission.VIEW_USERS)
    return Response.json(await listUsersAndAccess(user))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_USERS)
    const input = await parseJsonBody(request, userInputSchema)
    return Response.json(await createUser(input, user), { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
