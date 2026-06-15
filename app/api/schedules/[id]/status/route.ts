import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { setScheduleStatus } from "@/src/lib/operations/service"
import { scheduleStatusSchema } from "@/src/lib/operations/validation"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_SCHEDULES)
    const input = await parseJsonBody(request, scheduleStatusSchema)
    return Response.json({ schedule: await setScheduleStatus((await context.params).id, input.status, user) })
  } catch (error) {
    return errorResponse(error)
  }
}
