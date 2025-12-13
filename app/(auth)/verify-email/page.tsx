"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { authClient, useSession } from "@/lib/auth-client";

type VerificationState = "loading" | "success" | "error" | "already-verified";

const VerifyEmailPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [state, setState] = useState<VerificationState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const token = searchParams.get("token");
  const callbackURL = searchParams.get("callbackUrl") || "/";

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setState("error");
        setErrorMessage("No verification token provided");
        return;
      }

      try {
        const response = await authClient.verifyEmail({
          query: { token },
        });

        if (response.error) {
          setState("error");
          setErrorMessage(response.error.message || "Verification failed");
          return;
        }

        setState("success");

        // Auto-redirect after 3 seconds if logged in
        setTimeout(() => {
          if (session) {
            router.push(callbackURL);
          } else {
            router.push("/login?verified=true");
          }
        }, 3000);
      } catch {
        setState("error");
        setErrorMessage("An unexpected error occurred during verification");
      }
    };

    verifyEmail();
  }, [token, session, router, callbackURL]);

  if (state === "loading") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Verifying your email</CardTitle>
          <CardDescription>
            Please wait while we verify your email address
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Spinner className="size-8" />
        </CardContent>
      </Card>
    );
  }

  if (state === "success") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <CheckCircle2 className="size-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Email verified!</CardTitle>
          <CardDescription>
            Your email has been verified successfully
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground text-sm">
          <p>You will be redirected shortly...</p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button asChild>
            <Link href={session ? callbackURL : "/login?verified=true"}>
              {session ? "Continue" : "Sign in"}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mb-4 flex justify-center">
          <XCircle className="size-16 text-destructive" />
        </div>
        <CardTitle className="text-2xl">Verification failed</CardTitle>
        <CardDescription>
          {errorMessage || "We couldn't verify your email address"}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center text-muted-foreground text-sm">
        <p>
          The verification link may have expired or already been used. Please
          try signing up again or contact support if the issue persists.
        </p>
      </CardContent>
      <CardFooter className="flex justify-center gap-4">
        <Button asChild variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild>
          <Link href="/signup">Sign up</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

export default VerifyEmailPage;
