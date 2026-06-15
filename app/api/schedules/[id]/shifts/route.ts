import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { addScheduleShift } from "@/src/lib/operations/service"
import { scheduleShiftSchema } from "@/src/lib/operations/validation"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_SCHEDULES)
    return Response.json({ shift: await addScheduleShift((await context.params).id, await parseJsonBody(request, scheduleShiftSchema), user) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
