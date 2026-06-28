import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5e6c8] p-6">
      <SignIn routing="hash" signUpUrl="/sign-up" forceRedirectUrl="/" />
    </div>
  );
}
