"use client";

import {
  CircleX,
  CircleAlert,
  SquareDashedMousePointer,
  LoaderCircle,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkflowSkeleton } from "@/components/workflow-skeleton";
import Link from "next/link";
import { useTransition } from "react";
import { newJourney } from "@/app/api/journey/new";
import { Spinner } from "./ui/spinner";

export function LoadingFallback() {
  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 w-dvw h-dvh inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl animate-in fade-in-0 zoom-in-95 duration-300">
        {/* Terminal Window */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          {/* Window Header with macOS traffic lights */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <div className="flex items-center gap-1 justify-center">
              <div className="h-px w-10 border-t border-dashed border-zinc-700 flex-1" />
              <LoaderCircle className="h-4 w-4 text-zinc-700" />
              <span className="font-mono text-sm text-zinc-500">loading</span>
            </div>
            <div className="w-16" />
          </div>

          <div className="p-12">
            <div className="mb-12">
              <WorkflowSkeleton variant="default" />
            </div>

            <div className="mb-1 flex items-center gap-3">
              <span className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 font-mono text-sm text-zinc-400">
                <LoaderCircle className="h-5 w-5 animate-spin" />
              </span>
              <h1 className="text-center text-2xl font-semibold text-white">
                Loading Journey...
              </h1>
            </div>

            <p className="mb-4 text-zinc-400 max-w-xl leading-relaxed animate-fade-in opacity-0">
              Phew, this is taking longer than usual. Let's see if the journey
              exists.
            </p>

            <div className="flex gap-3">
              <Button
                asChild
                className="bg-white text-black hover:bg-zinc-200 animate-fade-in opacity-0"
              >
                <Link href="/" className="flex items-center gap-2">
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
    <div className="fixed top-0 left-0 right-0 bottom-0 w-dvw h-dvh inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl animate-in fade-in-0 zoom-in-95 duration-300">
        {/* Terminal Window */}
        <div className="rounded-xl border border-red-900/50 bg-zinc-950 shadow-2xl">
          {/* Window Header with macOS traffic lights */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <div className="flex items-center gap-1 justify-center">
              <div className="h-px w-10 border-t border-dashed border-zinc-700 flex-1" />
              <CircleX className="h-4 w-4 text-zinc-700" />
              <span className="font-mono text-sm text-zinc-500">error</span>
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
              <span className="rounded-md border border-red-900 bg-red-950 px-3 py-1 h-full font-mono text-sm text-red-400">
                Error
              </span>
              <h1 className="text-center text-2xl font-semibold text-white">
                Something Went Wrong!
              </h1>
            </div>
            <p className="mb-4 text-zinc-400 max-w-xl leading-relaxed">
              Oops, Sorry about that. Please try again or create a new journey.
            </p>

            <div className="flex gap-3">
              <Button asChild className="bg-white text-black hover:bg-zinc-200">
                <Link href="/" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  <span>Home</span>
                </Link>
              </Button>
              <Button
                asChild
                className="bg-white text-black hover:bg-zinc-200"
                disabled={pending}
              >
                <Link
                  href="/new"
                  onClick={handleCreateNewJourney}
                  className="flex items-center gap-2"
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
    <div className="fixed top-0 left-0 right-0 bottom-0 w-dvw h-dvh inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl animate-in fade-in-0 zoom-in-95 duration-300">
        {/* Terminal Window */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          {/* Window Header with macOS traffic lights */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <div className="flex items-center gap-1 justify-center">
              <div className="h-px w-10 border-t border-dashed border-zinc-700 flex-1" />
              <CircleAlert className="h-4 w-4 text-zinc-700" />
              <span className="font-mono text-sm text-zinc-500">404</span>
            </div>
            <div className="w-16" />
          </div>

          {/* Content */}
          <div className="p-12">
            <div className="mb-12">
              <WorkflowSkeleton variant="notfound" />
            </div>

            <div className="mb-1 flex items-center gap-3">
              <span className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 font-mono text-sm text-zinc-400">
                404
              </span>
              <h1 className="text-center text-2xl font-semibold text-white">
                Journey Not Found
              </h1>
            </div>

            <p className="mb-4 text-zinc-400 max-w-xl leading-relaxed">
              The journey you're looking for doesn't exist or has been removed
            </p>

            <div className="flex gap-3">
              <Button asChild className="bg-white text-black hover:bg-zinc-200">
                <Link href="/" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  <span>Home</span>
                </Link>
              </Button>
              <Button
                asChild
                className="bg-white text-black hover:bg-zinc-200"
                disabled={pending}
              >
                <Link
                  href="/new"
                  onClick={handleCreateNewJourney}
                  className="flex items-center gap-2"
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
