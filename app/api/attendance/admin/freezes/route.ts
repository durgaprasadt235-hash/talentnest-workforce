import { releaseFreeze } from "@/src/lib/attendance/service"
import { freezeReleaseRequestSchema } from "@/src/lib/attendance/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function POST(request: Request) {
  try {
    await requireServerPermission(request, Permission.APPROVE_ATTENDANCE)
    const body = await parseJsonBody(request, freezeReleaseRequestSchema)
    return Response.json({
      freeze: await releaseFreeze(body.freezeId, body.note, body.userId),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
