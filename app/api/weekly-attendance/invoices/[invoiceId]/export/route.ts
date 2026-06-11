import { errorResponse } from "@/src/lib/http"
import { prisma } from "@/src/lib/prisma"
import { Permission } from "@/src/lib/rbac/permissions"
import { AuthorizationError, requireServerPermission } from "@/src/lib/rbac/server-guard"
import { Role } from "@/src/lib/rbac/roles"

export async function GET(
  request: Request,
  context: RouteContext<"/api/weekly-attendance/invoices/[invoiceId]/export">,
) {
  try {
    const user = requireServerPermission(request, Permission.VIEW_INVOICES)
    if (user.role !== Role.FINANCE_USER) throw new AuthorizationError("Only finance can export invoices.")
    const { invoiceId } = await context.params
    const invoice = await prisma.weeklyAttendanceInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        organization: { select: { name: true } },
        property: { select: { name: true } },
        staffingCompany: { select: { displayName: true } },
      },
    })
    if (!invoice) throw new Error("Weekly attendance invoice not found.")

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
      ["Total Amount", invoice.totalAmount.toString()],
      ["Status", invoice.status],
    ]
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
