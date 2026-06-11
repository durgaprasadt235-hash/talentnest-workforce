import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { getServerCurrentUser, requireServerPermission } from "@/src/lib/rbac/server-guard"
import { Role } from "@/src/lib/rbac/roles"
import { createWeeklyAttendanceInvoiceSchema } from "@/src/lib/weekly-attendance/validation"
import { createWeeklyAttendanceInvoice } from "@/src/lib/weekly-attendance/workflow-service"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const currentUser = getServerCurrentUser(request)
    const user = requireServerPermission(
      request,
      currentUser.role === Role.STAFFING_COMPANY_ADMIN
        ? Permission.GENERATE_STAFFING_INVOICE
        : Permission.MANAGE_WEEKLY_ATTENDANCE_PAYABLES,
    )
    const { id } = await context.params
    const input = await parseJsonBody(request, createWeeklyAttendanceInvoiceSchema)
    return Response.json({ invoice: await createWeeklyAttendanceInvoice(id, user, input) })
  } catch (error) {
    return errorResponse(error)
  }
}
