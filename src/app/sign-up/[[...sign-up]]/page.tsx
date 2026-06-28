import { SignUp } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return (
    <div className="western-page-shell flex min-h-screen items-center justify-center p-6">
      <SignUp routing="hash" signInUrl="/sign-in" forceRedirectUrl="/" />
    </div>
  );
}
