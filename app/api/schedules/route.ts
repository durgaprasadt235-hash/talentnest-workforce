import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { createSchedule, listScheduleData } from "@/src/lib/operations/service"
import { scheduleSchema } from "@/src/lib/operations/validation"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function GET(request: Request) {
  try {
    return Response.json(await listScheduleData(await requireServerPermission(request, Permission.VIEW_SCHEDULES)))
  } catch (error) {
    return errorResponse(error, 500)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_SCHEDULES)
    return Response.json({ schedule: await createSchedule(await parseJsonBody(request, scheduleSchema), user) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
