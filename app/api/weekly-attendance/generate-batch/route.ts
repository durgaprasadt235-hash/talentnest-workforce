import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { batchGenerateWeeklyAttendanceSchema } from "@/src/lib/weekly-attendance/validation"
import { generateWeeklyAttendanceForProperties } from "@/src/lib/weekly-attendance/workflow-service"

export async function POST(request: Request) {
  try {
    const user = requireServerPermission(request, Permission.BATCH_WEEKLY_ATTENDANCE)
    const input = await parseJsonBody(request, batchGenerateWeeklyAttendanceSchema)
    return Response.json({ batches: await generateWeeklyAttendanceForProperties(user, input) })
  } catch (error) {
    return errorResponse(error)
  }
}
