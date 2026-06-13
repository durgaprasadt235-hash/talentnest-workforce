import { errorResponse } from "@/src/lib/http"
import { getInvoiceDetail } from "@/src/lib/invoices/service"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function GET(
  request: Request,
  context: RouteContext<"/api/weekly-attendance/invoices/[invoiceId]/export">,
) {
  try {
    const user = await requireServerPermission(request, Permission.VIEW_INVOICES)
    const { invoiceId } = await context.params
    const invoice = await getInvoiceDetail(invoiceId, user)

    const rows = [
      ["Invoice Number", invoice.invoiceNumber],
      ["Organization", invoice.organization.name],
      ["Property", invoice.property.name],
      ["Staffing Company", invoice.staffingCompany?.displayName ?? "Direct payroll"],
      ["Billing Week Start", invoice.billingWeekStart.toISOString().slice(0, 10)],
      ["Billing Week End", invoice.billingWeekEnd.toISOString().slice(0, 10)],
      ["Direct Hours", invoice.directHours.toString()],
      ["Staffing Hours", invoice.staffingHours.toString()],
      ["Total Hours", invoice.totalHours.toString()],
      ["Rate", invoice.rate.toString()],
      ["Total Amount", invoice.totalAmount.toString()],
      ["Status", invoice.status],
    ]
    rows.push([], ["Employee", "Employee Number", "Department", "Staffing Company", "Regular Hours", "Overtime Hours", "Total Hours"])
    for (const line of invoice.lines) {
      rows.push([
        `${line.employee.firstName} ${line.employee.lastName}`,
        line.employee.employeeNumber,
        line.department?.name ?? "Not assigned",
        line.staffingCompany?.displayName ?? "Direct",
        line.regularHours.toString(),
        line.overtimeHours.toString(),
        line.totalHours.toString(),
      ])
    }
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n")
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${invoice.invoiceNumber}.csv"`,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}
