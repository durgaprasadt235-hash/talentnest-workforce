import { SignIn } from "@clerk/nextjs"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>
}) {
  const redirectUrl = safeRedirect((await searchParams).redirect_url)

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn fallbackRedirectUrl={redirectUrl} forceRedirectUrl={redirectUrl} />
    </div>
  )
}

function safeRedirect(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard"
}
