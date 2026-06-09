"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableCell, TableHead } from "@/components/ui/table"
import { mockRoleHeaders } from "@/src/lib/rbac/mock-auth"

type ResourceItem = {
  id: string
  name: string
  status: string
  detail?: string | null
  parent?: string | null
}

export function DatabaseResourceList({
  title,
  description,
  endpoint,
  responseKey,
  emptyMessage,
  mapItem,
}: {
  title: string
  description: string
  endpoint: string
  responseKey: string
  emptyMessage: string
  mapItem: (value: Record<string, unknown>) => ResourceItem
}) {
  const { currentUser } = useCurrentUser()
  const [items, setItems] = useState<ResourceItem[]>([])
  const [error, setError] = useState("")
  const headers = useMemo(
    () => mockRoleHeaders(currentUser.role),
    [currentUser.role],
  )

  const load = useCallback(async () => {
    const response = await fetch(endpoint, { headers })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)
    setItems((result[responseKey] as Record<string, unknown>[]).map(mapItem))
  }, [endpoint, headers, mapItem, responseKey])

  useEffect(() => {
    // Initial remote synchronization is intentionally client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((caught: Error) => setError(caught.message))
  }, [load])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader><h2 className="font-semibold">{title}</h2></CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <TableHead>Name</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Status</TableHead>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    {item.parent && <p>{item.parent}</p>}
                    <p className="text-xs text-muted-foreground">{item.detail || "—"}</p>
                  </TableCell>
                  <TableCell><Badge>{item.status}</Badge></TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
          {items.length === 0 && !error && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
