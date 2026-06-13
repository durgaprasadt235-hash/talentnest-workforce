import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { createWeeklyAttendanceInvoice } from "@/src/lib/weekly-attendance/workflow-service"

export async function POST(
  request: Request,
  context: RouteContext<"/api/weekly-attendance/[id]/create-invoice">,
) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_WEEKLY_ATTENDANCE_PAYABLES)
    const { id } = await context.params
    return Response.json({ invoices: await createWeeklyAttendanceInvoice(id, user) })
  } catch (error) {
    return errorResponse(error)
  }
}
