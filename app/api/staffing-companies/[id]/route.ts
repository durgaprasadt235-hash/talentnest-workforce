import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { saveStaffingCompany } from "@/src/lib/operations/service"
import { staffingCompanySchema } from "@/src/lib/operations/validation"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_STAFFING_COMPANIES)
    return Response.json({ staffingCompany: await saveStaffingCompany(await parseJsonBody(request, staffingCompanySchema), user, (await context.params).id) })
  } catch (error) {
    return errorResponse(error)
  }
}
