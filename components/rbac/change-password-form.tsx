"use client"

import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function ChangePasswordForm() {
  const { user } = useUser()
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    if (newPassword !== confirmPassword) return setError("New passwords do not match.")
    setBusy(true)
    setError("")
    try {
      await user.updatePassword({ currentPassword, newPassword })
      const response = await fetch("/api/auth/change-password-complete", { method: "POST" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      router.replace("/dashboard")
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to change password.")
    } finally {
      setBusy(false)
    }
  }

  return <div className="mx-auto max-w-lg">
    <Card>
      <CardHeader>
        <h1 className="text-2xl font-semibold">Change Password</h1>
        <p className="text-sm text-muted-foreground">Set a permanent password before continuing to TalentNest Workforce.</p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <label className="grid gap-2 text-sm font-medium">Temporary password<Input type="password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
          <label className="grid gap-2 text-sm font-medium">New password<Input type="password" required minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
          <label className="grid gap-2 text-sm font-medium">Confirm new password<Input type="password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button disabled={busy} type="submit">{busy ? "Updating..." : "Change password"}</Button>
        </form>
      </CardContent>
    </Card>
  </div>
}
