import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <div className="western-page-shell flex min-h-screen items-center justify-center p-6">
      <SignIn routing="hash" signUpUrl="/sign-up" forceRedirectUrl="/" />
    </div>
  );
}
