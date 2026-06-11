import { errorResponse } from "@/src/lib/http"
import { getInvoiceDetail } from "@/src/lib/invoices/service"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function GET(
  request: Request,
  context: RouteContext<"/api/weekly-attendance/invoices/[invoiceId]">,
) {
  try {
    const user = requireServerPermission(request, Permission.VIEW_INVOICES)
    const { invoiceId } = await context.params
    return Response.json({ invoice: await getInvoiceDetail(invoiceId, user) })
  } catch (error) {
    return errorResponse(error)
  }
}
