import { RecordStatus } from "@prisma/client"
import { errorResponse } from "@/src/lib/http"
import { setDepartmentStatus } from "@/src/lib/master-data/service"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
type Context = { params: Promise<{ id: string }> }
export async function POST(request: Request, { params }: Context) {
  try {
    await requireServerPermission(request, Permission.MANAGE_DEPARTMENTS)
    return Response.json({ department: await setDepartmentStatus((await params).id, RecordStatus.ACTIVE) })
  } catch (error) { return errorResponse(error) }
}
