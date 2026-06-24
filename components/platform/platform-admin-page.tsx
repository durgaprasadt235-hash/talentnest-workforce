"use client"

import { useState } from "react"
import { ArrowRight, Download, Filter, Plus, Search } from "lucide-react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableCell, TableHead } from "@/components/ui/table"
import { hasPermission } from "@/src/lib/rbac/guards"
import { mockRoleHeaders } from "@/src/lib/rbac/mock-auth"
import type { Permission } from "@/src/lib/rbac/permissions"

type Metric = {
  label: string
  value: string
  detail: string
  href?: string
}

type TableColumn = {
  key: string
  label: string
}

type PlatformAction = {
  label: string
  action: string
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link"
  critical?: boolean
}

type PlatformAdminPageProps = {
  title: string
  eyebrow: string
  description: string
  requiredPermission: Permission
  metrics?: Metric[]
  tabs?: string[]
  columns: TableColumn[]
  rows: Record<string, string>[]
  primaryActions?: PlatformAction[]
  rowActions?: PlatformAction[]
  emptyState: string
}

export function PlatformAdminPage({
  title,
  eyebrow,
  description,
  requiredPermission,
  metrics = [],
  tabs = [],
  columns,
  rows,
  primaryActions = [],
  rowActions = [],
  emptyState,
}: PlatformAdminPageProps) {
  const { currentUser } = useCurrentUser()
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const allowed = hasPermission(currentUser, requiredPermission)

  async function runAction(action: PlatformAction, entityId?: string) {
    setMessage("")
    setError("")

    if (action.critical && !window.confirm(`Confirm ${action.label}?`)) return

    const response = await fetch("/api/platform-actions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...mockRoleHeaders(currentUser.role, {
          organizationId: currentUser.organizationId,
          propertyIds: currentUser.propertyIds,
          staffingCompanyId: currentUser.staffingCompanyId,
        }),
      },
      body: JSON.stringify({
        action: action.action,
        entityType: title,
        entityId,
        metadata: { label: action.label, module: title },
      }),
    })
    const body = await response.json()
    if (!response.ok) {
      setError(body.error ?? "Unable to complete action.")
      return
    }
    setMessage(`${action.label} logged.`)
  }

  if (!allowed) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Access Denied</h1>
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Your platform role does not have permission to view {title}.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {primaryActions.map((action) => (
            <Button key={action.action} variant={action.variant ?? "default"} onClick={() => void runAction(action)}>
              <Plus className="size-4" />
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {(message || error) && (
        <p className={error ? "text-sm text-destructive" : "text-sm text-emerald-700"}>{error || message}</p>
      )}

      {metrics.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {metrics.map((metric) => (
            <Card key={metric.label} className="transition hover:border-primary/40">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                    <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="space-y-4">
          {tabs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab, index) => (
                <Badge key={tab} className={index === 0 ? "" : "bg-muted text-muted-foreground"}>
                  {tab}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="relative min-w-64 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder={`Search ${title.toLowerCase()}...`}
                className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <div className="flex gap-2">
              <Button variant="outline"><Filter className="size-4" /> Filter</Button>
              <Button variant="outline"><Download className="size-4" /> Export</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                {columns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}
                {rowActions.length > 0 && <TableHead>Actions</TableHead>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      {statusLike(column.key) ? <Badge>{row[column.key]}</Badge> : row[column.key]}
                    </TableCell>
                  ))}
                  {rowActions.length > 0 && (
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {rowActions.map((action) => (
                          <Button
                            key={action.action}
                            variant={action.variant ?? "ghost"}
                            size="sm"
                            onClick={() => void runAction(action, row.id)}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  )}
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <TableCell colSpan={columns.length + (rowActions.length ? 1 : 0)} className="py-14 text-center text-muted-foreground">
                    {emptyState}
                  </TableCell>
                </tr>
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function statusLike(key: string) {
  return key.toLowerCase().includes("status") || key.toLowerCase().includes("plan")
}
