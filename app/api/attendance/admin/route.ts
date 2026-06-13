import { getAttendanceAdminData } from "@/src/lib/attendance/service"
import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function GET(request: Request) {
  try {
    await requireServerPermission(request, Permission.APPROVE_ATTENDANCE)
    return Response.json(await getAttendanceAdminData())
  } catch (error) {
    return errorResponse(error, 500)
  }
}
