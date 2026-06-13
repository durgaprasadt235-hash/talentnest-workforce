"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableCell, TableHead } from "@/components/ui/table"
import { hasPermission } from "@/src/lib/rbac/guards"
import { mockRoleHeaders } from "@/src/lib/rbac/mock-auth"
import { Permission } from "@/src/lib/rbac/permissions"

type Option = { id: string; name: string }
type PropertyOption = Option & { organizationId: string }
type BatchSummary = {
  id: string
  weekStartDate: string
  weekEndDate: string
  status: string
  generatedAt: string
  organization: Option
  property: Option
  approvedAt: string | null
  lines: Array<{
    totalHours: string
    staffingCompanyId: string | null
    approvalStatus: string
  }>
  invoices: WeeklyInvoice[]
  _count: { lines: number }
}
type AttendanceLine = {
  id: string
  regularHours: string
  overtimeHours: string
  totalHours: string
  missingPunchCount: number
  exceptionCount: number
  correctionPendingCount: number
  approvalStatus: string
  managerNote: string | null
  employee: {
    employeeNumber: string
    firstName: string
    lastName: string
  }
  department: Option | null
  staffingCompany: { id: string; displayName: string } | null
}
type BatchDetail = Omit<BatchSummary, "_count" | "lines"> & {
  approvedAt: string | null
  sentToCorporateAt: string | null
  sentToFinanceAt: string | null
  managerReminderAt: string | null
  financeReviewedAt: string | null
  approvedByUser: { id: string; firstName: string; lastName: string } | null
  lines: AttendanceLine[]
  invoices: WeeklyInvoice[]
}
type WeeklyInvoice = {
  id: string
  invoiceNumber: string
  type: "DIRECT" | "STAFFING" | "CONSOLIDATED"
  status: string
  directHours: string
  staffingHours: string
  regularHours: string
  overtimeHours: string
  totalHours: string
  totalAmount: string
  staffingCompany: { id: string; displayName: string } | null
}

const batchStatusOptions: Option[] = [
  { id: "", name: "All statuses" },
  { id: "DRAFT", name: "Draft" },
  { id: "PENDING_MANAGER_REVIEW", name: "Pending manager review" },
  { id: "APPROVED", name: "Approved" },
  { id: "CORRECTIONS_REQUIRED", name: "Corrections required" },
  { id: "LOCKED", name: "Locked" },
  { id: "SENT_TO_CORPORATE", name: "Sent to corporate" },
  { id: "SENT_TO_FINANCE", name: "Sent to finance" },
  { id: "INVOICED", name: "Invoiced" },
  { id: "PAID", name: "Paid" },
]

export function WeeklyAttendance() {
  const { currentUser } = useCurrentUser()
  const [batches, setBatches] = useState<BatchSummary[]>([])
  const [organizations, setOrganizations] = useState<Option[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [organizationId, setOrganizationId] = useState("")
  const [propertyId, setPropertyId] = useState("")
  const [filterOrganizationId, setFilterOrganizationId] = useState("")
  const [filterPropertyId, setFilterPropertyId] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [weekStartDate, setWeekStartDate] = useState(currentWeekStart())
  const [selectedBatch, setSelectedBatch] = useState<BatchDetail | null>(null)
  const [selectedStaffingCompanyId, setSelectedStaffingCompanyId] = useState("")
  const [managerNote, setManagerNote] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const headers = useMemo(
    () =>
      mockRoleHeaders(currentUser.role, {
        organizationId: currentUser.organizationId,
        propertyIds: currentUser.propertyIds,
        staffingCompanyId: currentUser.staffingCompanyId,
      }),
    [currentUser],
  )

  const load = useCallback(async () => {
    const query = new URLSearchParams()
    if (filterOrganizationId) query.set("organizationId", filterOrganizationId)
    if (filterPropertyId) query.set("propertyId", filterPropertyId)
    if (filterStatus) query.set("status", filterStatus)

    const response = await fetch(
      `/api/weekly-attendance${query.toString() ? `?${query.toString()}` : ""}`,
      { headers },
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    setBatches(data.batches)
    setOrganizations(data.options.organizations)
    setProperties(data.options.properties)
    if (data.message) setMessage(data.message)
  }, [headers, filterOrganizationId, filterPropertyId, filterStatus])

  const loadBatch = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/weekly-attendance/${id}`, { headers })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setSelectedStaffingCompanyId("")
      setSelectedBatch(data.batch)
    },
    [headers],
  )

  useEffect(() => {
    // Initial remote synchronization is intentionally client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((caught: Error) => setError(caught.message))
  }, [load])

  const availableGenerateProperties = properties.filter(
    (property) => property.organizationId === organizationId,
  )
  const availableFilterProperties = properties.filter(
    (property) => property.organizationId === filterOrganizationId,
  )
  const staffingCompanies = useMemo(() => {
    if (!selectedBatch) return []

    return selectedBatch.lines
      .filter((line): line is AttendanceLine & { staffingCompany: { id: string; displayName: string } } =>
        line.staffingCompany !== null,
      )
      .reduce<{ id: string; name: string }[]>((unique, line) => {
        if (!unique.some((company) => company.id === line.staffingCompany.id)) {
          unique.push({ id: line.staffingCompany.id, name: line.staffingCompany.displayName })
        }
        return unique
      }, [])
  }, [selectedBatch])
  const filteredLines = useMemo(
    () =>
      selectedBatch
        ? selectedBatch.lines.filter(
            (line) =>
              !selectedStaffingCompanyId ||
              (selectedStaffingCompanyId === "DIRECT" && !line.staffingCompany) ||
              line.staffingCompany?.id === selectedStaffingCompanyId,
          )
        : [],
    [selectedBatch, selectedStaffingCompanyId],
  )
  const canGenerate = hasPermission(
    currentUser,
    Permission.GENERATE_WEEKLY_ATTENDANCE,
  )
  const canApprove = hasPermission(
    currentUser,
    Permission.APPROVE_WEEKLY_ATTENDANCE,
  )
  const canLock = hasPermission(currentUser, Permission.LOCK_WEEKLY_ATTENDANCE)

  const selectedBatchStatus = selectedBatch?.status
  const canApproveBatch = canApprove && selectedBatchStatus === "PENDING_MANAGER_REVIEW"
  const canRequestCorrectionsBatch =
    canApprove &&
    (selectedBatchStatus === "DRAFT" || selectedBatchStatus === "PENDING_MANAGER_REVIEW")
  const canLockBatch = canLock && selectedBatchStatus === "APPROVED"
  // Role-based UI visibility
  const isCorporateAdmin = ["CORPORATE_ADMIN", "ORGANIZATION_OWNER"].includes(
    currentUser.role,
  )
  const canSendFinance = currentUser.role === "CORPORATE_ADMIN"
  const isPropertyManager = currentUser.role === "PROPERTY_MANAGER"
  const isStaffingCompanyAdmin = [
    "STAFFING_ADMIN",
    "STAFFING_BILLING",
  ].includes(currentUser.role)
  const isFinanceUser = currentUser.role === "FINANCE_USER"

  const showFilterSection = isCorporateAdmin || isPropertyManager

  async function exportReport(reportType: string, batchId = selectedBatch?.id) {
    if (!batchId) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch(
        `/api/weekly-attendance/${batchId}/export?type=${reportType}`,
        { headers },
      )
      if (!response.ok) throw new Error("Export failed.")
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `weekly-attendance-${reportType}-${batchId}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Export failed.")
    } finally {
      setBusy(false)
    }
  }

  async function generate() {
    if (!organizationId || !propertyId || !weekStartDate) {
      return setError("Select an organization, property, and week.")
    }
    await runAction("/api/weekly-attendance/generate", {
      organizationId,
      propertyId,
      weekStartDate,
    }, "Weekly attendance batch is ready.")
  }

  async function approve() {
    if (!selectedBatch) return
    await runAction(
      `/api/weekly-attendance/${selectedBatch.id}/approve`,
      { overrideNote: managerNote || undefined },
      "Weekly attendance approved and payroll-ready.",
    )
  }

  async function requestCorrections() {
    if (!selectedBatch) return
    if (!managerNote.trim()) {
      return setError("Enter a manager note before requesting corrections.")
    }
    await runAction(
      `/api/weekly-attendance/${selectedBatch.id}/request-corrections`,
      { managerNote },
      "Corrections requested.",
    )
  }

  async function lock() {
    if (!selectedBatch) return
    await runAction(
      `/api/weekly-attendance/${selectedBatch.id}/lock`,
      undefined,
      "Weekly attendance batch locked.",
    )
  }

  async function sendToCorporate() {
    if (!selectedBatch) return
    await runWorkflowAction(
      `/api/weekly-attendance/${selectedBatch.id}/send-corporate`,
      undefined,
      "Weekly attendance sent to corporate.",
      selectedBatch.id,
    )
  }

  async function sendToFinance() {
    if (!selectedBatch) return
    await runWorkflowAction(
      `/api/weekly-attendance/${selectedBatch.id}/send-finance`,
      undefined,
      "Approved weekly attendance sent to finance.",
      selectedBatch.id,
    )
  }

  async function remindManager(batchId: string) {
    await runWorkflowAction(
      `/api/weekly-attendance/${batchId}/remind-manager`,
      undefined,
      "Reminder sent to the property manager.",
      selectedBatch?.id === batchId ? batchId : undefined,
    )
  }

  async function returnToManager(batchId: string) {
    await runWorkflowAction(
      `/api/weekly-attendance/${batchId}/return-manager`,
      undefined,
      "Batch returned to the property manager for review.",
      selectedBatch?.id === batchId ? batchId : undefined,
    )
  }

  async function viewInvoiceStatus() {
    if (!selectedBatch) return
    await loadBatch(selectedBatch.id)
    setMessage("Invoice status refreshed.")
  }

  async function createInvoice() {
    if (!selectedBatch) return
    await runWorkflowAction(
      `/api/weekly-attendance/${selectedBatch.id}/create-invoice`,
      undefined,
      "Draft direct and staffing invoices created.",
      selectedBatch.id,
    )
  }

  async function markInvoiceSent(invoiceId: string) {
    if (!selectedBatch) return
    await runWorkflowAction(
      `/api/weekly-attendance/invoices/${invoiceId}/mark-sent`,
      undefined,
      "Invoice marked sent.",
      selectedBatch.id,
    )
  }

  async function markInvoicePaid(invoiceId: string) {
    if (!selectedBatch) return
    await runWorkflowAction(
      `/api/weekly-attendance/invoices/${invoiceId}/mark-paid`,
      undefined,
      "Invoice marked paid.",
      selectedBatch.id,
    )
  }

  async function exportInvoice(invoiceId: string, invoiceNumber: string) {
    setBusy(true)
    setError("")
    try {
      const response = await fetch(`/api/weekly-attendance/invoices/${invoiceId}/export`, { headers })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }
      const url = window.URL.createObjectURL(await response.blob())
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${invoiceNumber}.csv`
      anchor.click()
      window.URL.revokeObjectURL(url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invoice export failed.")
    } finally {
      setBusy(false)
    }
  }

  async function runWorkflowAction(
    path: string,
    body: Record<string, unknown> | undefined,
    successMessage: string,
    batchId?: string,
  ) {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          ...(body ? { "content-type": "application/json" } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setMessage(successMessage)
      await load()
      if (batchId) await loadBatch(batchId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.")
    } finally {
      setBusy(false)
    }
  }

  async function runAction(
    path: string,
    body: Record<string, unknown> | undefined,
    successMessage: string,
  ) {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          ...(body ? { "content-type": "application/json" } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setManagerNote("")
      setMessage(successMessage)
      await load()
      if (data.batch?.id) await loadBatch(data.batch.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        {isCorporateAdmin && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Corporate Workforce Operations</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage all properties, review staffing company hours, and prepare payroll summaries.
            </p>
          </>
        )}
        {isPropertyManager && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Property Manager Weekly Review</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Generate, review, and approve weekly attendance for your property.
            </p>
          </>
        )}
        {isStaffingCompanyAdmin && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Staffing Company Timesheet View</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Review approved hours and prepare invoices for your staffing company employees.
            </p>
          </>
        )}
        {isFinanceUser && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Finance Weekly Billing Review</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Review and process payroll and staffing company invoices.
            </p>
          </>
        )}
      </div>

      {(message || error) && (
        <p className={error ? "rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" : "rounded-lg border bg-muted/40 p-4 text-sm"}>
          {error || message}
        </p>
      )}

      {isCorporateAdmin && (
        <div className="grid gap-4 md:grid-cols-5">
          <SummaryCard label="Pending manager review" value={String(batches.filter((batch) => batch.status === "PENDING_MANAGER_REVIEW" || batch.status === "CORRECTIONS_REQUIRED").length)} unit="properties" />
          <SummaryCard label="Approved properties" value={String(batches.filter((batch) => batch.status === "APPROVED" || batch.status === "SENT_TO_CORPORATE").length)} unit="properties" />
          <SummaryCard label="Locked properties" value={String(batches.filter((batch) => batch.status === "LOCKED").length)} unit="properties" />
          <SummaryCard label="Direct employee hours" value={sumBatchHours(batches, false)} unit="hrs" />
          <SummaryCard label="Staffing employee hours" value={sumBatchHours(batches, true)} unit="hrs" />
        </div>
      )}

      {isFinanceUser && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="Pending Finance Review" value={String(batches.filter((batch) => batch.status === "SENT_TO_FINANCE").length)} unit="batches" />
            <SummaryCard label="Ready For Invoice" value={String(batches.filter((batch) => batch.status === "SENT_TO_FINANCE" && batch.invoices.length === 0).length)} unit="batches" />
            <SummaryCard label="Invoices Sent" value={String(allInvoices(batches).filter((invoice) => invoice.status === "SENT").length)} unit="invoices" />
            <SummaryCard label="Invoices Paid" value={String(allInvoices(batches).filter((invoice) => invoice.status === "PAID").length)} unit="invoices" />
          </div>
          <div className="grid gap-4 md:grid-cols-5">
            <SummaryCard label="Total Direct Hours" value={sumInvoiceField(batches, "directHours")} unit="hrs" />
            <SummaryCard label="Total Staffing Hours" value={sumInvoiceField(batches, "staffingHours")} unit="hrs" />
            <SummaryCard label="Total Invoice Amount" value={formatCurrency(sumInvoiceAmounts(batches))} unit="amount" />
            <SummaryCard label="Outstanding Amount" value={formatCurrency(sumInvoiceAmounts(batches, false))} unit="amount" />
            <SummaryCard label="Paid Amount" value={formatCurrency(sumInvoiceAmounts(batches, true))} unit="amount" />
          </div>
        </>
      )}

      {selectedBatch && !isCorporateAdmin && (
        <div className="grid gap-4 md:grid-cols-4">
          {isPropertyManager && (
            <>
              <SummaryCard
                label="Property Hours"
                value={selectedBatch.lines.reduce((sum, line) => sum + Number(line.totalHours), 0).toFixed(2)}
                unit="hrs"
              />
              <SummaryCard
                label="Pending Corrections"
                value={String(selectedBatch.lines.filter((line) => line.correctionPendingCount > 0).length)}
                unit="items"
              />
              <SummaryCard
                label="Exceptions Found"
                value={String(selectedBatch.lines.filter((line) => line.exceptionCount > 0).length)}
                unit="items"
              />
              <SummaryCard
                label="Employees Reviewed"
                value={String(new Set(selectedBatch.lines.map((line) => line.employee.employeeNumber)).size)}
                unit="total"
              />
            </>
          )}
          {isStaffingCompanyAdmin && (
            <>
              <SummaryCard
                label="Staffing Employee Hours"
                value={selectedBatch.lines.reduce((sum, line) => sum + Number(line.totalHours), 0).toFixed(2)}
                unit="hrs"
              />
              <SummaryCard
                label="Approved Billable Hours"
                value={selectedBatch.status === "APPROVED" || selectedBatch.status === "LOCKED"
                  ? selectedBatch.lines.reduce((sum, line) => sum + Number(line.totalHours), 0).toFixed(2)
                  : "0.00"}
                unit="hrs"
              />
              <SummaryCard
                label="Properties Served"
                value={String(1)}
                unit="property"
              />
              <SummaryCard
                label="Invoice Status"
                value={selectedBatch.status === "APPROVED" || selectedBatch.status === "LOCKED" ? "Ready" : "Pending"}
                unit="status"
              />
            </>
          )}
          {isFinanceUser && (
            <>
              <SummaryCard label="Total Direct Hours" value={selectedBatch.lines.filter((line) => !line.staffingCompany).reduce((sum, line) => sum + Number(line.totalHours), 0).toFixed(2)} unit="hrs" />
              <SummaryCard
                label="Total Staffing Hours"
                value={selectedBatch.lines
                  .filter((line) => line.staffingCompany)
                  .reduce((sum, line) => sum + Number(line.totalHours), 0)
                  .toFixed(2)}
                unit="hrs"
              />
              <SummaryCard
                label="Total Invoice Amount"
                value={formatCurrency(selectedBatch.invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0))}
                unit="amount"
              />
              <SummaryCard
                label="Outstanding Amount"
                value={formatCurrency(selectedBatch.invoices.filter((invoice) => invoice.status !== "PAID").reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0))}
                unit="amount"
              />
            </>
          )}
        </div>
      )}

      {canGenerate && (
        <Card>
          <CardHeader><h2 className="font-semibold">Generate weekly attendance</h2></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <SelectField label="Organization" value={organizationId} onChange={(value) => { setOrganizationId(value); setPropertyId("") }} options={organizations} />
            <SelectField label="Property" value={propertyId} onChange={setPropertyId} options={availableGenerateProperties} />
            <label className="space-y-2 text-sm font-medium">
              <span>Week starting</span>
              <Input type="date" value={weekStartDate} onChange={(event) => setWeekStartDate(event.target.value)} />
            </label>
            <div className="flex items-end">
              <Button disabled={busy} className="w-full" onClick={generate}>Generate weekly attendance</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showFilterSection && (
        <Card>
          <CardHeader><h2 className="font-semibold">Filter batches</h2></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <SelectField label="Organization" value={filterOrganizationId} onChange={(value) => { setFilterOrganizationId(value); setFilterPropertyId("") }} options={organizations} />
            <SelectField label="Property" value={filterPropertyId} onChange={setFilterPropertyId} options={availableFilterProperties} />
            {isCorporateAdmin && <SelectField label="Status" value={filterStatus} onChange={setFilterStatus} options={batchStatusOptions} />}
            <div className="flex items-end">
              <Button disabled={busy} className="w-full" onClick={() => load().catch((caught: Error) => setError(caught.message))}>Refresh</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><h2 className="font-semibold">{isCorporateAdmin ? "Property status" : "Weekly batches"}</h2></CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead><tr>{isCorporateAdmin ? <><TableHead>Property</TableHead><TableHead>Week</TableHead><TableHead>Status</TableHead><TableHead>Manager approval status</TableHead><TableHead>Total hours</TableHead><TableHead>Direct hours</TableHead><TableHead>Staffing hours</TableHead><TableHead>Action</TableHead></> : <><TableHead>Week</TableHead><TableHead>Organization</TableHead><TableHead>Property</TableHead><TableHead>Lines</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead></>}</tr></thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  {isCorporateAdmin ? <>
                    <TableCell>{batch.property.name}</TableCell>
                    <TableCell>{formatDate(batch.weekStartDate)}</TableCell>
                    <TableCell><StatusBadge status={batch.status} /></TableCell>
                    <TableCell>{batch.approvedAt ? "Approved" : "Pending"}</TableCell>
                    <TableCell>{batchHours(batch).total}</TableCell>
                    <TableCell>{batchHours(batch).direct}</TableCell>
                    <TableCell>{batchHours(batch).staffing}</TableCell>
                    <TableCell><div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => loadBatch(batch.id).catch((caught: Error) => setError(caught.message))}>View</Button>
                      {(batch.status === "PENDING_MANAGER_REVIEW" || batch.status === "CORRECTIONS_REQUIRED") && <Button size="sm" variant="outline" onClick={() => remindManager(batch.id)}>Send reminder</Button>}
                      {["APPROVED", "LOCKED", "SENT_TO_CORPORATE"].includes(batch.status) && <Button size="sm" variant="outline" onClick={() => returnToManager(batch.id)}>Return to manager</Button>}
                      {canSendFinance && batch.status === "LOCKED" && <Button size="sm" onClick={() => runWorkflowAction(`/api/weekly-attendance/${batch.id}/send-finance`, undefined, "Locked weekly attendance sent to finance.")}>Send To Finance</Button>}
                      <Button size="sm" variant="outline" onClick={() => exportReport("property", batch.id)}>Export property</Button>
                    </div></TableCell>
                  </> : <>
                    <TableCell>{formatDate(batch.weekStartDate)} - {formatDate(batch.weekEndDate)}</TableCell>
                    <TableCell>{batch.organization.name}</TableCell>
                    <TableCell>{batch.property.name}</TableCell>
                    <TableCell>{batch._count.lines}</TableCell>
                    <TableCell><StatusBadge status={batch.status} /></TableCell>
                    <TableCell><Button size="sm" variant="outline" onClick={() => loadBatch(batch.id).catch((caught: Error) => setError(caught.message))}>View</Button></TableCell>
                  </>}
                </tr>
              ))}
            </tbody>
          </Table>
          {batches.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No weekly attendance batches found for your role.</p>}
        </CardContent>
      </Card>

      {selectedBatch && (
        <Card>
          <CardHeader className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="font-semibold">{selectedBatch.property.name}: {formatDate(selectedBatch.weekStartDate)} - {formatDate(selectedBatch.weekEndDate)}</h2>
                <div className="mt-2"><StatusBadge status={selectedBatch.status} /></div>
              </div>
              <div className="flex flex-wrap gap-2">
                {isCorporateAdmin && (
                  <>
                    <Button disabled={busy} size="sm" onClick={() => exportReport("consolidated")}>
                      Export consolidated
                    </Button>
                    <Button disabled={busy} size="sm" variant="outline" onClick={() => exportReport("property")}>
                      Export property report
                    </Button>
                    <Button disabled={busy} size="sm" variant="outline" onClick={() => exportReport("staffing-timesheet")}>
                      Export staffing report
                    </Button>
                    {canSendFinance && <Button disabled={busy || selectedBatch.status !== "LOCKED"} size="sm" variant="outline" onClick={sendToFinance}>Send to Finance</Button>}
                  </>
                )}
                {isPropertyManager && (
                  <>
                    {canApproveBatch && (
                      <Button disabled={busy} onClick={approve}>Approve batch</Button>
                    )}
                    {canRequestCorrectionsBatch && (
                      <Button disabled={busy} variant="outline" onClick={requestCorrections}>
                        Request corrections
                      </Button>
                    )}
                    {canLockBatch && <Button disabled={busy} onClick={lock}>Lock batch</Button>}
                    <Button disabled={busy} size="sm" variant="outline" onClick={() => exportReport("property-detail")}>
                      Export report
                    </Button>
                    <Button disabled={busy || !["APPROVED", "LOCKED"].includes(selectedBatch.status)} size="sm" variant="outline" onClick={sendToCorporate}>Send to corporate</Button>
                  </>
                )}
                {isStaffingCompanyAdmin && (
                  <>
                    <Button disabled={busy} size="sm" onClick={() => exportReport("staffing-timesheet")}>
                      Export timesheet
                    </Button>
                    <Button disabled={busy} size="sm" variant="outline" onClick={viewInvoiceStatus}>View invoice status</Button>
                  </>
                )}
                {isFinanceUser && (
                  <>
                    <Button disabled={busy} size="sm" onClick={() => exportReport("finance-summary")}>
                      Export payroll summary
                    </Button>
                    <Button disabled={busy} size="sm" variant="outline" onClick={() => exportReport("staffing-timesheet")}>
                      Export staffing payable
                    </Button>
                    <Button disabled={busy || selectedBatch.status !== "SENT_TO_FINANCE"} size="sm" variant="outline" onClick={createInvoice}>Create Invoice</Button>
                  </>
                )}
              </div>
            </div>
            {selectedBatch.status === "CORRECTIONS_REQUIRED" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                This batch requires corrections before it can be approved.
              </div>
            )}
            {selectedBatch.approvedAt && selectedBatch.approvedByUser && (
              <div className="text-sm text-muted-foreground">
                Approved {formatDateTime(selectedBatch.approvedAt)} by {selectedBatch.approvedByUser.firstName} {selectedBatch.approvedByUser.lastName}
              </div>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>Corporate: {selectedBatch.sentToCorporateAt ? formatDateTime(selectedBatch.sentToCorporateAt) : "Not sent"}</span>
              <span>Finance: {selectedBatch.sentToFinanceAt ? formatDateTime(selectedBatch.sentToFinanceAt) : "Not sent"}</span>
              {selectedBatch.financeReviewedAt && <span>Finance review: {formatDateTime(selectedBatch.financeReviewedAt)}</span>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-0">
            {staffingCompanies.length > 0 && (isCorporateAdmin || isPropertyManager || isFinanceUser) && (
              <div className="px-5 pt-5">
                <SelectField
                  label="Staffing company"
                  value={selectedStaffingCompanyId}
                  onChange={setSelectedStaffingCompanyId}
                  options={[{ id: "", name: "All employees" }, { id: "DIRECT", name: "Direct employees" }, ...staffingCompanies]}
                />
              </div>
            )}
            {isPropertyManager && canApprove && selectedBatch.status !== "LOCKED" && (
              <div className="px-5 pt-5">
                <Input value={managerNote} onChange={(event) => setManagerNote(event.target.value)} placeholder="Manager note or missing-punch override note" />
              </div>
            )}
            <Table>
              <thead><tr><TableHead>Employee</TableHead><TableHead>Department</TableHead><TableHead>Staffing company</TableHead><TableHead>Regular</TableHead><TableHead>Overtime</TableHead><TableHead>Total</TableHead><TableHead>Missing punches</TableHead><TableHead>Exceptions</TableHead><TableHead>Corrections</TableHead><TableHead>Approval</TableHead></tr></thead>
              <tbody>
                {filteredLines.map((line) => (
                  <tr key={line.id}>
                    <TableCell><p className="font-medium">{line.employee.firstName} {line.employee.lastName}</p><p className="text-xs text-muted-foreground">{line.employee.employeeNumber}</p></TableCell>
                    <TableCell>{line.department?.name ?? "Not assigned"}</TableCell>
                    <TableCell>{line.staffingCompany?.displayName ?? "Direct"}</TableCell>
                    <TableCell>{formatHours(line.regularHours)}</TableCell>
                    <TableCell>{formatHours(line.overtimeHours)}</TableCell>
                    <TableCell className="font-medium">{formatHours(line.totalHours)}</TableCell>
                    <TableCell>{line.missingPunchCount}</TableCell>
                    <TableCell>{line.exceptionCount}</TableCell>
                    <TableCell>{line.correctionPendingCount > 0 ? `${line.correctionPendingCount} pending` : line.managerNote ?? "None"}</TableCell>
                    <TableCell><StatusBadge status={line.approvalStatus} /></TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
            {filteredLines.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No attendance records found.</p>}
            {selectedBatch.invoices.length > 0 && (
              <div className="border-t p-5">
                <h3 className="mb-3 font-semibold">Invoices and payables</h3>
                <Table>
                  <thead><tr><TableHead>Invoice</TableHead><TableHead>Type</TableHead><TableHead>Staffing company</TableHead><TableHead>Direct hours</TableHead><TableHead>Staffing hours</TableHead><TableHead>Total hours</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead>{isFinanceUser && <TableHead>Action</TableHead>}</tr></thead>
                  <tbody>
                    {selectedBatch.invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <TableCell className="font-mono text-xs">{invoice.invoiceNumber}</TableCell>
                        <TableCell>{invoice.type}</TableCell>
                        <TableCell>{invoice.staffingCompany?.displayName ?? "Direct payroll"}</TableCell>
                        <TableCell>{formatHours(invoice.directHours)}</TableCell>
                        <TableCell>{formatHours(invoice.staffingHours)}</TableCell>
                        <TableCell>{formatHours(invoice.totalHours)}</TableCell>
                        <TableCell>{formatCurrency(Number(invoice.totalAmount))}</TableCell>
                        <TableCell><StatusBadge status={invoice.status} /></TableCell>
                        {isFinanceUser && <TableCell><div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => exportInvoice(invoice.id, invoice.invoiceNumber)}>Export Invoice</Button>
                          {invoice.status === "DRAFT" && <Button size="sm" onClick={() => markInvoiceSent(invoice.id)}>Mark Sent</Button>}
                          {invoice.status === "SENT" && <Button size="sm" onClick={() => markInvoicePaid(invoice.id)}>Mark Paid</Button>}
                        </div></TableCell>}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-semibold">{value}</p>
            <p className="text-xs text-muted-foreground">{unit}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
}) {
  return (
    <label className="space-y-2 text-sm font-medium">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-8 w-full rounded-lg border bg-background px-2.5 text-sm">
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  )
}

function StatusBadge({ status }: { status: string }) {
  return <Badge>{status.replaceAll("_", " ").toLowerCase()}</Badge>
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { timeZone: "UTC" })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatHours(value: string) {
  return Number(value).toFixed(2)
}

function batchHours(batch: BatchSummary) {
  const direct = batch.lines
    .filter((line) => !line.staffingCompanyId)
    .reduce((total, line) => total + Number(line.totalHours), 0)
  const staffing = batch.lines
    .filter((line) => line.staffingCompanyId)
    .reduce((total, line) => total + Number(line.totalHours), 0)

  return {
    direct: direct.toFixed(2),
    staffing: staffing.toFixed(2),
    total: (direct + staffing).toFixed(2),
  }
}

function sumBatchHours(batches: BatchSummary[], staffing: boolean) {
  return batches
    .flatMap((batch) => batch.lines)
    .filter((line) => Boolean(line.staffingCompanyId) === staffing)
    .reduce((total, line) => total + Number(line.totalHours), 0)
    .toFixed(2)
}

function allInvoices(batches: BatchSummary[]) {
  return batches.flatMap((batch) => batch.invoices)
}

function sumInvoiceField(batches: BatchSummary[], field: "directHours" | "staffingHours") {
  return allInvoices(batches)
    .reduce((total, invoice) => total + Number(invoice[field]), 0)
    .toFixed(2)
}

function sumInvoiceAmounts(batches: BatchSummary[], paid?: boolean) {
  return allInvoices(batches)
    .filter((invoice) => paid === undefined || (invoice.status === "PAID") === paid)
    .reduce((total, invoice) => total + Number(invoice.totalAmount), 0)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value)
}

function currentWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  now.setDate(now.getDate() + mondayOffset)
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-")
}
