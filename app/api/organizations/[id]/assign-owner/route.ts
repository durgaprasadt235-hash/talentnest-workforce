import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { assignOrganizationOwner } from "@/src/lib/master-data/service"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { z } from "zod"

const schema = z.object({ userId: z.string().trim().min(1) })

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireServerPermission(request, Permission.MANAGE_ORGANIZATION)
    const input = await parseJsonBody(request, schema)
    return Response.json(await assignOrganizationOwner((await params).id, input.userId, actor))
  } catch (error) {
    return errorResponse(error)
  }
}
