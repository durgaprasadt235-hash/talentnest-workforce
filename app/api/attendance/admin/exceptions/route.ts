import { resolveException } from "@/src/lib/attendance/service"
import { exceptionActionRequestSchema } from "@/src/lib/attendance/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function POST(request: Request) {
  try {
    await requireServerPermission(request, Permission.APPROVE_ATTENDANCE)
    return Response.json({
      exception: await resolveException(
        await parseJsonBody(request, exceptionActionRequestSchema),
      ),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
