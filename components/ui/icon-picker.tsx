"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getIcon,
  iconKeys,
  iconMap,
  popularIconKeys,
} from "@/lib/utils/icon-mapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface IconPickerProps {
  value?: string;
  onChange: (iconKey: string) => void;
  disabled?: boolean;
}

type IconTab = "popular" | "all";

export function IconPicker({ value, onChange, disabled }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<IconTab>("popular");

  // Filter popular icons to only those that exist in iconMap
  const validPopularIcons = useMemo(() => {
    return popularIconKeys.filter((key) => iconMap[key]);
  }, []);

  const filteredIcons = useMemo(() => {
    const baseIcons = activeTab === "popular" ? validPopularIcons : iconKeys;

    if (!search.trim()) {
      return baseIcons;
    }
    const searchLower = search.toLowerCase();
    return baseIcons.filter((key) => key.includes(searchLower));
  }, [search, activeTab, validPopularIcons]);

  const CurrentIcon = getIcon(value) || iconMap.circle;

  const handleSelect = (iconKey: string) => {
    onChange(iconKey);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className="h-16 w-16 rounded-xl transition-colors hover:bg-muted/80"
          disabled={disabled}
          size="lg"
          variant="ghost"
        >
          <CurrentIcon
            className="size-10 text-muted-foreground"
            strokeWidth={1.5}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0" sideOffset={8}>
        <div className="border-b p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="h-9 pl-9"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons..."
              value={search}
            />
          </div>
        </div>

        {/* Tab buttons */}
        <div className="flex gap-1 border-b px-3 py-2">
          <button
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              activeTab === "popular"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
            onClick={() => setActiveTab("popular")}
            type="button"
          >
            Popular
          </button>
          <button
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              activeTab === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
            onClick={() => setActiveTab("all")}
            type="button"
          >
            All ({iconKeys.length})
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto p-2">
          {filteredIcons.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground text-sm">
              No icons found
            </p>
          ) : (
            <div className="grid grid-cols-8 gap-1">
              {filteredIcons.map((iconKey) => {
                const Icon = iconMap[iconKey];
                if (!Icon) return null;
                const isSelected = value === iconKey;
                return (
                  <button
                    className={cn(
                      "flex items-center justify-center rounded-md p-2 transition-colors hover:bg-muted",
                      isSelected && "bg-primary/10 ring-1 ring-primary"
                    )}
                    key={iconKey}
                    onClick={() => handleSelect(iconKey)}
                    title={iconKey}
                    type="button"
                  >
                    <Icon className="size-4" strokeWidth={1.5} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
