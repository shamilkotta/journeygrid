export function WorkflowSkeleton({
  variant = "default",
}: {
  variant?: "default" | "error" | "notfound";
}) {
  const getAccentColor = () => {
    switch (variant) {
      case "error":
        return "border-red-500/30";
      case "notfound":
        return "border-yellow-500/30";
      default:
        return "border-zinc-700";
    }
  };

  const getIconColor = () => {
    switch (variant) {
      case "error":
        return "bg-red-900/20 border-red-800";
      case "notfound":
        return "bg-yellow-900/20 border-yellow-800";
      default:
        return "bg-zinc-800/20 border-zinc-700";
    }
  };

  return (
    <div>
      <div className="relative flex items-center gap-3">
        <div
          className={`relative rounded-lg border ${getAccentColor()} animate-pulse bg-zinc-900/50 px-4 py-3 pr-16 delay-150`}
        >
          <div className="-left-2 -top-2 absolute">
            <div className={`h-6 w-6 rounded-md border ${getIconColor()}`} />
          </div>
          <div className="-translate-y-1/2 -translate-x-1/2 absolute top-1/2 left-0 h-2 w-2 rounded-full border-2 border-zinc-700 bg-zinc-900" />
          <div className="flex items-center gap-2">
            <div className={`h-10 w-10 rounded-lg ${getIconColor()}`} />
            <div className="space-y-2">
              <div className="h-3 w-20 rounded bg-zinc-700" />
              <div className="h-2 w-12 rounded bg-zinc-800" />
            </div>
          </div>
          <div className="-translate-y-1/2 absolute top-1/2 right-0 h-2 w-2 translate-x-1/2 rounded-full border-2 border-zinc-700 bg-zinc-900" />
        </div>
        <div className="h-px w-12 border-zinc-700 border-t border-dashed" />
      </div>

      {/* second row */}
      <div className="relative mt-4 flex items-center gap-3">
        <div className="h-px w-16 border-zinc-700 border-t border-dashed" />
        <div
          className={`relative rounded-lg border ${getAccentColor()} animate-pulse bg-zinc-900/50 px-4 py-3 pr-16 delay-150`}
        >
          <div className="-translate-y-1/2 -translate-x-1/2 absolute top-1/2 left-0 h-2 w-2 rounded-full border-2 border-zinc-700 bg-zinc-900" />
          <div className="flex items-center gap-2">
            <div className={`h-10 w-10 rounded-lg ${getIconColor()}`} />
            <div className="space-y-2">
              <div className="h-3 w-20 rounded bg-zinc-700" />
              <div className="h-2 w-12 rounded bg-zinc-800" />
            </div>
          </div>
          <div className="-translate-y-1/2 absolute top-1/2 right-0 h-2 w-2 translate-x-1/2 rounded-full border-2 border-zinc-700 bg-zinc-900" />
        </div>
        {/* Connecting line - middle */}
        <div className="h-px w-12 border-zinc-700 border-t border-dashed" />
        <div
          className={`relative rounded-lg border ${getAccentColor()} animate-pulse bg-zinc-900/50 px-4 py-3 pr-16 delay-150`}
        >
          <div className="-left-2 -top-2 absolute">
            <div className={`h-6 w-6 rounded-md border ${getIconColor()}`} />
          </div>
          <div className="-translate-y-1/2 -translate-x-1/2 absolute top-1/2 left-0 h-2 w-2 rounded-full border-2 border-zinc-700 bg-zinc-900" />
          <div className="flex items-center gap-2">
            <div className={`h-10 w-10 rounded-lg ${getIconColor()}`} />
            <div className="space-y-2">
              <div className="h-3 w-20 rounded bg-zinc-700" />
              <div className="h-2 w-12 rounded bg-zinc-800" />
            </div>
          </div>
          <div className="-right-2 -top-1 absolute h-[70px] w-56 bg-linear-to-r from-transparent to-80% to-zinc-950" />
        </div>
      </div>
    </div>
  );
}
