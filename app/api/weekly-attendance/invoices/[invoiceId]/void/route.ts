import { errorResponse } from "@/src/lib/http"
import { voidInvoice } from "@/src/lib/invoices/service"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function POST(
  request: Request,
  context: RouteContext<"/api/weekly-attendance/invoices/[invoiceId]/void">,
) {
  try {
    const user = requireServerPermission(request, Permission.MANAGE_WEEKLY_ATTENDANCE_PAYABLES)
    const { invoiceId } = await context.params
    return Response.json({ invoice: await voidInvoice(invoiceId, user) })
  } catch (error) {
    return errorResponse(error)
  }
}
