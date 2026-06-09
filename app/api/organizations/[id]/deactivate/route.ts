import { RecordStatus } from "@prisma/client"
import { errorResponse } from "@/src/lib/http"
import { setOrganizationStatus } from "@/src/lib/master-data/service"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
type Context = { params: Promise<{ id: string }> }
export async function POST(request: Request, { params }: Context) {
  try {
    requireServerPermission(request, Permission.MANAGE_ORGANIZATION)
    return Response.json({ organization: await setOrganizationStatus((await params).id, RecordStatus.INACTIVE) })
  } catch (error) { return errorResponse(error) }
}
