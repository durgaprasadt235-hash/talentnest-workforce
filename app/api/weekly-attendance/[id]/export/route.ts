import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { getWeeklyAttendanceBatchByRole } from "@/src/lib/weekly-attendance/role-service"

export async function GET(
  request: Request,
  context: RouteContext<"/api/weekly-attendance/[id]/export">,
) {
  try {
    const user = requireServerPermission(request, Permission.VIEW_WEEKLY_ATTENDANCE)
    const { id } = await context.params
    const url = new URL(request.url)
    const reportType = url.searchParams.get("type") || "consolidated"

    const batch = await getWeeklyAttendanceBatchByRole(id, user)

    // Build CSV based on report type
    let csv = ""
    const headers: string[] = []
    const rows: string[][] = []

    if (reportType === "consolidated") {
      headers.push(
        "Week Starting",
        "Property",
        "Total Direct Hours",
        "Total Agency Hours",
        "Total Overtime",
        "Direct Employee Count",
        "Agency Employee Count",
        "Status",
      )
      const directHours = batch.lines
        .filter((line) => !line.staffingCompany)
        .reduce((sum, line) => sum + Number(line.totalHours), 0)
      const agencyHours = batch.lines
        .filter((line) => line.staffingCompany)
        .reduce((sum, line) => sum + Number(line.totalHours), 0)
      const overtimeHours = batch.lines.reduce(
        (sum, line) => sum + Number(line.overtimeHours),
        0,
      )
      const directCount = new Set(
        batch.lines
          .filter((line) => !line.staffingCompany)
          .map((line) => line.employee.id),
      ).size
      const agencyCount = new Set(
        batch.lines
          .filter((line) => line.staffingCompany)
          .map((line) => line.employee.id),
      ).size

      rows.push([
        new Date(batch.weekStartDate).toLocaleDateString(),
        batch.property.name,
        directHours.toFixed(2),
        agencyHours.toFixed(2),
        overtimeHours.toFixed(2),
        String(directCount),
        String(agencyCount),
        batch.status,
      ])
    } else if (reportType === "property") {
      headers.push(
        "Employee",
        "Employee ID",
        "Department",
        "Regular Hours",
        "Overtime Hours",
        "Total Hours",
        "Missing Punches",
        "Exceptions",
        "Corrections",
        "Status",
      )
      for (const line of batch.lines) {
        rows.push([
          `${line.employee.firstName} ${line.employee.lastName}`,
          line.employee.employeeNumber,
          line.department?.name || "Not assigned",
          Number(line.regularHours).toFixed(2),
          Number(line.overtimeHours).toFixed(2),
          Number(line.totalHours).toFixed(2),
          String(line.missingPunchCount),
          String(line.exceptionCount),
          String(line.correctionPendingCount),
          line.approvalStatus,
        ])
      }
    } else if (reportType === "staffing-timesheet") {
      headers.push(
        "Staffing Company",
        "Employee",
        "Property",
        "Regular Hours",
        "Overtime Hours",
        "Total Hours",
        "Status",
      )
      const staffingLines = batch.lines.filter((line) => line.staffingCompany)
      for (const line of staffingLines) {
        rows.push([
          line.staffingCompany?.displayName || "Direct",
          `${line.employee.firstName} ${line.employee.lastName}`,
          batch.property.name,
          Number(line.regularHours).toFixed(2),
          Number(line.overtimeHours).toFixed(2),
          Number(line.totalHours).toFixed(2),
          line.approvalStatus,
        ])
      }
    } else if (reportType === "finance-summary") {
      headers.push(
        "Category",
        "Employee Count",
        "Regular Hours",
        "Overtime Hours",
        "Total Hours",
      )
      const directLines = batch.lines.filter((line) => !line.staffingCompany)
      const staffingLines = batch.lines.filter((line) => line.staffingCompany)

      if (directLines.length > 0) {
        const directRegular = directLines.reduce(
          (sum, line) => sum + Number(line.regularHours),
          0,
        )
        const directOvertime = directLines.reduce(
          (sum, line) => sum + Number(line.overtimeHours),
          0,
        )
        rows.push([
          "Direct Employees",
          String(new Set(directLines.map((l) => l.employee.id)).size),
          directRegular.toFixed(2),
          directOvertime.toFixed(2),
          (directRegular + directOvertime).toFixed(2),
        ])
      }

      if (staffingLines.length > 0) {
        const staffingRegular = staffingLines.reduce(
          (sum, line) => sum + Number(line.regularHours),
          0,
        )
        const staffingOvertime = staffingLines.reduce(
          (sum, line) => sum + Number(line.overtimeHours),
          0,
        )
        rows.push([
          "Staffing Company Employees",
          String(new Set(staffingLines.map((l) => l.employee.id)).size),
          staffingRegular.toFixed(2),
          staffingOvertime.toFixed(2),
          (staffingRegular + staffingOvertime).toFixed(2),
        ])
      }
    } else if (reportType === "property-detail") {
      headers.push(
        "Employee",
        "Employee ID",
        "Department",
        "Staffing Company",
        "Regular Hours",
        "Overtime Hours",
        "Total Hours",
        "Missing Punches",
        "Exceptions",
        "Corrections",
        "Status",
      )
      for (const line of batch.lines) {
        rows.push([
          `${line.employee.firstName} ${line.employee.lastName}`,
          line.employee.employeeNumber,
          line.department?.name || "Not assigned",
          line.staffingCompany?.displayName || "Direct",
          Number(line.regularHours).toFixed(2),
          Number(line.overtimeHours).toFixed(2),
          Number(line.totalHours).toFixed(2),
          String(line.missingPunchCount),
          String(line.exceptionCount),
          String(line.correctionPendingCount),
          line.approvalStatus,
        ])
      }
    }

    // Build CSV
    csv = headers.map((h) => `"${h}"`).join(",") + "\n"
    csv += rows
      .map((row) =>
        row
          .map((cell) => {
            const escaped = String(cell).replace(/"/g, '""')
            return `"${escaped}"`
          })
          .join(","),
      )
      .join("\n")

    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="weekly-attendance-${reportType}-${batch.id}.csv"`,
      },
    })
  } catch (error) {
    return errorResponse(error, 500)
  }
}
