import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { listWeeklyAttendanceByRole } from "@/src/lib/weekly-attendance/role-service"

export async function GET(request: Request) {
  try {
    const user = requireServerPermission(request, Permission.VIEW_WEEKLY_ATTENDANCE)
    const url = new URL(request.url)
    const requestedStatus = url.searchParams.get("status")
    const status = Object.values(WeeklyAttendanceBatchStatus).find(
      (candidate) => candidate === requestedStatus,
    )
    return Response.json(await listWeeklyAttendanceByRole(user, {
      organizationId: url.searchParams.get("organizationId") || undefined,
      propertyId: url.searchParams.get("propertyId") || undefined,
      status,
    }))
  } catch (error) {
    return errorResponse(error, 500)
  }
}
import { WeeklyAttendanceBatchStatus } from "@prisma/client"
