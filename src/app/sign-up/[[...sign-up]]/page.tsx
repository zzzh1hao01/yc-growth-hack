import { SignUp } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5e6c8] p-6">
      <SignUp routing="hash" signInUrl="/sign-in" forceRedirectUrl="/" />
    </div>
  );
}
