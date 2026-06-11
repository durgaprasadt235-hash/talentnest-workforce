import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { markInvoiceReviewComplete } from "@/src/lib/weekly-attendance/workflow-service"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const user = requireServerPermission(request, Permission.MANAGE_WEEKLY_ATTENDANCE_PAYABLES)
    const { id } = await context.params
    return Response.json({ batch: await markInvoiceReviewComplete(id, user) })
  } catch (error) {
    return errorResponse(error)
  }
}
