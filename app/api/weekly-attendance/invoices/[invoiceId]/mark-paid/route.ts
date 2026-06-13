import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { markWeeklyAttendanceInvoicePaid } from "@/src/lib/weekly-attendance/workflow-service"

type Context = { params: Promise<{ invoiceId: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_WEEKLY_ATTENDANCE_PAYABLES)
    const { invoiceId } = await context.params
    return Response.json({ invoice: await markWeeklyAttendanceInvoicePaid(invoiceId, user) })
  } catch (error) {
    return errorResponse(error)
  }
}
