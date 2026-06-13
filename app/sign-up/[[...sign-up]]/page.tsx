import { SignUp } from "@clerk/nextjs"

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>
}) {
  const redirectUrl = safeRedirect((await searchParams).redirect_url)

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp fallbackRedirectUrl={redirectUrl} forceRedirectUrl={redirectUrl} />
    </div>
  )
}

function safeRedirect(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard"
}
