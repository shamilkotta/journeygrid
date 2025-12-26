"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenuPlugin } from "@tiptap/extension-bubble-menu";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface FloatingToolbarProps {
  editor: Editor;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}

const ToolbarButton = ({
  onClick,
  isActive,
  disabled,
  children,
  title,
}: ToolbarButtonProps) => (
  <Button
    className={cn(
      "h-7 w-7 p-0",
      isActive && "bg-accent text-accent-foreground"
    )}
    disabled={disabled}
    onClick={onClick}
    size="icon"
    title={title}
    type="button"
    variant="ghost"
  >
    {children}
  </Button>
);

export function FloatingToolbar({ editor }: FloatingToolbarProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const pluginRegistered = useRef(false);

  const setLink = useCallback(() => {
    if (linkUrl) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: linkUrl })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    }
    setIsLinkOpen(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const openLinkPopover = useCallback(() => {
    const previousUrl = editor.getAttributes("link").href;
    setLinkUrl(previousUrl || "");
    setIsLinkOpen(true);
  }, [editor]);

  useEffect(() => {
    if (!editor || !toolbarRef.current || pluginRegistered.current) return;

    const plugin = BubbleMenuPlugin({
      pluginKey: "floatingToolbar",
      editor,
      element: toolbarRef.current,
      updateDelay: 0,
      shouldShow: ({ state }) => {
        const { selection } = state;
        const { empty } = selection;

        // Don't show if selection is empty
        if (empty) {
          setIsVisible(false);
          return false;
        }

        // Don't show if it's a node selection (like images)
        if (selection.constructor.name === "NodeSelection") {
          setIsVisible(false);
          return false;
        }

        // Show the toolbar with a microtask delay to ensure proper positioning
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
        return true;
      },
      options: {
        placement: "top",
        offset: { mainAxis: 8 },
      },
    });

    editor.registerPlugin(plugin);
    pluginRegistered.current = true;

    return () => {
      if (pluginRegistered.current) {
        editor.unregisterPlugin("floatingToolbar");
        pluginRegistered.current = false;
      }
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={cn(
        "z-50 flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-lg",
        "transition-opacity duration-100",
        isVisible
          ? "opacity-100 relative"
          : "pointer-events-none absolute opacity-0"
      )}
      ref={toolbarRef}
    >
      {/* Text Formatting */}
      <ToolbarButton
        isActive={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Cmd+B)"
      >
        <Bold className="size-4" />
      </ToolbarButton>

      <ToolbarButton
        isActive={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Cmd+I)"
      >
        <Italic className="size-4" />
      </ToolbarButton>

      <ToolbarButton
        isActive={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline (Cmd+U)"
      >
        <Underline className="size-4" />
      </ToolbarButton>

      <ToolbarButton
        isActive={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <Strikethrough className="size-4" />
      </ToolbarButton>

      <ToolbarButton
        isActive={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Code"
      >
        <Code className="size-4" />
      </ToolbarButton>

      <Separator className="mx-1 h-5" orientation="vertical" />

      {/* Link */}
      <Popover onOpenChange={setIsLinkOpen} open={isLinkOpen}>
        <PopoverTrigger asChild>
          <Button
            className={cn(
              "h-7 w-7 p-0",
              editor.isActive("link") && "bg-accent text-accent-foreground"
            )}
            onClick={openLinkPopover}
            size="icon"
            title="Add link"
            type="button"
            variant="ghost"
          >
            <Link className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-2" side="top">
          <div className="flex gap-2">
            <Input
              className="h-8 flex-1"
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setLink();
                }
              }}
              placeholder="https://example.com"
              value={linkUrl}
            />
            <Button className="h-8" onClick={setLink} size="sm">
              Save
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Separator className="mx-1 h-5" orientation="vertical" />

      {/* Block Formatting */}
      <ToolbarButton
        isActive={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
      >
        <Heading1 className="size-4" />
      </ToolbarButton>

      <ToolbarButton
        isActive={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        <Heading2 className="size-4" />
      </ToolbarButton>

      <ToolbarButton
        isActive={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
      >
        <Heading3 className="size-4" />
      </ToolbarButton>

      <Separator className="mx-1 h-5" orientation="vertical" />

      <ToolbarButton
        isActive={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        <List className="size-4" />
      </ToolbarButton>

      <ToolbarButton
        isActive={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>

      <ToolbarButton
        isActive={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Quote"
      >
        <Quote className="size-4" />
      </ToolbarButton>
    </div>
  );
}
