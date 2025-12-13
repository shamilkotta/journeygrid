"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { signIn, useSession } from "@/lib/auth-client";
import { getEnabledAuthProviders } from "@/lib/auth-providers";

const GitHubIcon = () => (
  <svg
    aria-label="GitHub"
    className="mr-2 h-4 w-4"
    fill="currentColor"
    role="img"
    viewBox="0 0 24 24"
  >
    <title>GitHub</title>
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const GoogleIcon = () => (
  <svg
    aria-label="Google"
    className="mr-2 h-4 w-4"
    role="img"
    viewBox="0 0 24 24"
  >
    <title>Google</title>
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="currentColor"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="currentColor"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="currentColor"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="currentColor"
    />
  </svg>
);

const VercelIcon = () => (
  <svg
    aria-label="Vercel"
    className="mr-2 h-3 w-3"
    fill="currentColor"
    role="img"
    viewBox="0 0 76 65"
  >
    <title>Vercel</title>
    <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
  </svg>
);

const LoginPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<
    "github" | "google" | "vercel" | null
  >(null);

  const enabledProviders = getEnabledAuthProviders();
  const callbackURL = searchParams.get("callbackUrl") || "/";

  // Redirect if already logged in
  useEffect(() => {
    if (session && !isPending) {
      router.push(callbackURL);
    }
  }, [session, isPending, router, callbackURL]);

  // Show verified message if coming from email verification
  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      toast.success("Email verified successfully! You can now sign in.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await signIn.email({
        email,
        password,
        callbackURL,
      });

      if (response.error) {
        if (response.error.code === "EMAIL_NOT_VERIFIED") {
          setError(
            "Please verify your email before signing in. Check your inbox for the verification link."
          );
        } else {
          setError(response.error.message || "Sign in failed");
        }
        return;
      }

      toast.success("Signed in successfully!");
      router.push(callbackURL);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignIn = async (
    provider: "github" | "google" | "vercel"
  ) => {
    try {
      setLoadingProvider(provider);
      await signIn.social({ provider, callbackURL });
    } catch {
      toast.error(`Failed to sign in with ${provider}`);
      setLoadingProvider(null);
    }
  };

  const hasSocialProviders =
    enabledProviders.github ||
    enabledProviders.google ||
    enabledProviders.vercel;

  // Show loading while checking session
  if (isPending) {
    return (
      <div className="flex items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your account to continue</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasSocialProviders && (
          <>
            <div className="flex flex-col gap-2">
              {enabledProviders.github && (
                <Button
                  className="w-full"
                  disabled={loadingProvider !== null}
                  onClick={() => handleSocialSignIn("github")}
                  type="button"
                  variant="outline"
                >
                  {loadingProvider === "github" ? (
                    <Spinner className="mr-2 size-4" />
                  ) : (
                    <GitHubIcon />
                  )}
                  Continue with GitHub
                </Button>
              )}
              {enabledProviders.google && (
                <Button
                  className="w-full"
                  disabled={loadingProvider !== null}
                  onClick={() => handleSocialSignIn("google")}
                  type="button"
                  variant="outline"
                >
                  {loadingProvider === "google" ? (
                    <Spinner className="mr-2 size-4" />
                  ) : (
                    <GoogleIcon />
                  )}
                  Continue with Google
                </Button>
              )}
              {enabledProviders.vercel && (
                <Button
                  className="w-full"
                  disabled={loadingProvider !== null}
                  onClick={() => handleSocialSignIn("vercel")}
                  type="button"
                  variant="outline"
                >
                  {loadingProvider === "vercel" ? (
                    <Spinner className="mr-2 size-4" />
                  ) : (
                    <VercelIcon />
                  )}
                  Continue with Vercel
                </Button>
              )}
            </div>

            {enabledProviders.email && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with email
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {enabledProviders.email && (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                autoComplete="email"
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                autoComplete="current-password"
                id="password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                type="password"
                value={password}
              />
            </div>
            {error && <div className="text-destructive text-sm">{error}</div>}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? <Spinner className="mr-2 size-4" /> : null}
              Sign In
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-4 text-center text-sm">
        <div className="text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            className="text-foreground underline-offset-4 hover:underline"
            href={`/signup${callbackURL !== "/" ? `?callbackUrl=${encodeURIComponent(callbackURL)}` : ""}`}
          >
            Sign up
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
};

export default LoginPage;
