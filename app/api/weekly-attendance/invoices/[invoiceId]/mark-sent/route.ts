import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { markWeeklyAttendanceInvoiceSent } from "@/src/lib/weekly-attendance/workflow-service"

export async function POST(
  request: Request,
  context: RouteContext<"/api/weekly-attendance/invoices/[invoiceId]/mark-sent">,
) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_WEEKLY_ATTENDANCE_PAYABLES)
    const { invoiceId } = await context.params
    return Response.json({ invoice: await markWeeklyAttendanceInvoiceSent(invoiceId, user) })
  } catch (error) {
    return errorResponse(error)
  }
}
