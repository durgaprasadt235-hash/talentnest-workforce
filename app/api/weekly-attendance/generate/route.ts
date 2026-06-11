import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { generateWeeklyAttendance } from "@/src/lib/weekly-attendance/service"
import { generateWeeklyAttendanceSchema } from "@/src/lib/weekly-attendance/validation"
import { assertWeeklyAttendanceGenerationScope } from "@/src/lib/weekly-attendance/workflow-service"

export async function POST(request: Request) {
  try {
    const user = requireServerPermission(request, Permission.GENERATE_WEEKLY_ATTENDANCE)
    const input = await parseJsonBody(request, generateWeeklyAttendanceSchema)
    assertWeeklyAttendanceGenerationScope(user, input)
    return Response.json({ batch: await generateWeeklyAttendance(input) })
  } catch (error) {
    return errorResponse(error)
  }
}
