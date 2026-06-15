import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { listStaffingCompanies, saveStaffingCompany } from "@/src/lib/operations/service"
import { staffingCompanySchema } from "@/src/lib/operations/validation"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function GET(request: Request) {
  try {
    const user = await requireServerPermission(request, Permission.VIEW_STAFFING_COMPANIES)
    return Response.json({ staffingCompanies: await listStaffingCompanies(user) })
  } catch (error) {
    return errorResponse(error, 500)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_STAFFING_COMPANIES)
    return Response.json({ staffingCompany: await saveStaffingCompany(await parseJsonBody(request, staffingCompanySchema), user) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
