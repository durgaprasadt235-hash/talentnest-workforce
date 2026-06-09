import { checkMissedClockOuts } from "@/src/lib/attendance/service"
import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function POST(request: Request) {
  try {
    requireServerPermission(request, Permission.APPROVE_ATTENDANCE)
    return Response.json(await checkMissedClockOuts())
  } catch (error) {
    return errorResponse(error, 500)
  }
}
