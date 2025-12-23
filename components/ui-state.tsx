"use client";

import {
  CircleAlert,
  CircleX,
  Home,
  LoaderCircle,
  SquareDashedMousePointer,
} from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { newJourney } from "@/app/api/journey/new";
import { Button } from "@/components/ui/button";
import { WorkflowSkeleton } from "@/components/workflow-skeleton";
import { Spinner } from "./ui/spinner";

export function LoadingFallback() {
  return (
    <div className="fixed inset-0 top-0 right-0 bottom-0 left-0 z-50 flex h-dvh w-dvw items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="fade-in-0 zoom-in-95 w-full max-w-3xl animate-in duration-300">
        {/* Terminal Window */}
        <div className="rounded-xl border border-border bg-card shadow-2xl">
          {/* Window Header with macOS traffic lights */}
          <div className="flex items-center justify-between border-border border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <div className="flex items-center justify-center gap-1">
              <div className="h-px w-10 flex-1 border-border border-t border-dashed" />
              <LoaderCircle className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-muted-foreground text-sm">
                loading
              </span>
            </div>
            <div className="w-16" />
          </div>

          <div className="p-12">
            <div className="mb-12">
              <WorkflowSkeleton variant="default" />
            </div>

            <div className="mb-1 flex items-center gap-3">
              <span className="rounded-md border border-border bg-muted px-3 py-1 font-mono text-muted-foreground text-sm">
                <LoaderCircle className="h-5 w-5 animate-spin" />
              </span>
              <h1 className="text-center font-semibold text-2xl text-foreground">
                Loading Journey...
              </h1>
            </div>

            <p className="mb-4 max-w-xl animate-fade-in text-muted-foreground leading-relaxed opacity-0">
              Phew, this is taking longer than usual. Let's see if the journey
              exists.
            </p>

            <div className="flex gap-3">
              <Button asChild className="animate-fade-in opacity-0">
                <Link className="flex items-center gap-2" href="/">
                  <Home className="h-4 w-4" />
                  <span>Go To Home</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const ErrorFallback = ({
  error,
}: {
  error: Error;
  reset: () => void;
}) => {
  const [pending, startTransition] = useTransition();
  const handleCreateNewJourney = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (pending) return;
    startTransition(newJourney);
  };

  return (
    <div className="fixed inset-0 top-0 right-0 bottom-0 left-0 z-50 flex h-dvh w-dvw items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="fade-in-0 zoom-in-95 w-full max-w-3xl animate-in duration-300">
        {/* Terminal Window */}
        <div className="rounded-xl border border-destructive/50 bg-card shadow-2xl">
          {/* Window Header with macOS traffic lights */}
          <div className="flex items-center justify-between border-border border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <div className="flex items-center justify-center gap-1">
              <div className="h-px w-10 flex-1 border-border border-t border-dashed" />
              <CircleX className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-muted-foreground text-sm">
                error
              </span>
            </div>
            <div className="w-16" />
          </div>

          {/* Content */}
          <div className="p-12">
            <div className="mb-12">
              <WorkflowSkeleton variant="error" />
            </div>

            {/* Error Badge */}
            <div className="mb-1 flex items-center gap-3">
              <span className="h-full rounded-md border border-destructive/50 bg-destructive/10 px-3 py-1 font-mono text-destructive text-sm dark:bg-destructive/20">
                Error
              </span>
              <h1 className="text-center font-semibold text-2xl text-foreground">
                Something Went Wrong!
              </h1>
            </div>
            <p className="mb-4 max-w-xl text-muted-foreground leading-relaxed">
              Oops, Sorry about that. Please try again or create a new journey.
            </p>

            <div className="flex gap-3">
              <Button asChild>
                <Link className="flex items-center gap-2" href="/">
                  <Home className="h-4 w-4" />
                  <span>Home</span>
                </Link>
              </Button>
              <Button asChild disabled={pending}>
                <Link
                  className="flex items-center gap-2"
                  href="/new"
                  onClick={handleCreateNewJourney}
                >
                  {pending ? (
                    <Spinner className="size-4" />
                  ) : (
                    <SquareDashedMousePointer className="h-4 w-4" />
                  )}
                  <span>Create New Journey</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const NotFoundFallback = () => {
  const [pending, startTransition] = useTransition();
  const handleCreateNewJourney = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (pending) return;
    startTransition(newJourney);
  };

  return (
    <div className="fixed inset-0 top-0 right-0 bottom-0 left-0 z-50 flex h-dvh w-dvw items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="fade-in-0 zoom-in-95 w-full max-w-3xl animate-in duration-300">
        {/* Terminal Window */}
        <div className="rounded-xl border border-border bg-card shadow-2xl">
          {/* Window Header with macOS traffic lights */}
          <div className="flex items-center justify-between border-border border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <div className="flex items-center justify-center gap-1">
              <div className="h-px w-10 flex-1 border-border border-t border-dashed" />
              <CircleAlert className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-muted-foreground text-sm">
                404
              </span>
            </div>
            <div className="w-16" />
          </div>

          {/* Content */}
          <div className="p-12">
            <div className="mb-12">
              <WorkflowSkeleton variant="notfound" />
            </div>

            <div className="mb-1 flex items-center gap-3">
              <span className="rounded-md border border-border bg-muted px-3 py-1 font-mono text-muted-foreground text-sm">
                404
              </span>
              <h1 className="text-center font-semibold text-2xl text-foreground">
                Journey Not Found
              </h1>
            </div>

            <p className="mb-4 max-w-xl text-muted-foreground leading-relaxed">
              The journey you're looking for doesn't exist or has been removed
            </p>

            <div className="flex gap-3">
              <Button asChild>
                <Link className="flex items-center gap-2" href="/">
                  <Home className="h-4 w-4" />
                  <span>Home</span>
                </Link>
              </Button>
              <Button asChild disabled={pending}>
                <Link
                  className="flex items-center gap-2"
                  href="/new"
                  onClick={handleCreateNewJourney}
                >
                  {pending ? (
                    <Spinner className="size-4" />
                  ) : (
                    <SquareDashedMousePointer className="h-4 w-4" />
                  )}
                  <span>Create New Journey</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
