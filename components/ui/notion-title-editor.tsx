"use client";

import type { Editor } from "@tiptap/react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { EditorView } from "@tiptap/pm/view";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface NotionTitleEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export function NotionTitleEditor({
  value,
  onChange,
  placeholder = "Untitled",
  disabled = false,
  className,
  autoFocus = false,
}: NotionTitleEditorProps) {
  const isUpdatingFromProp = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        hardBreak: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content: value || "",
    editable: !disabled,
    autofocus: autoFocus ? "end" : false,
    onUpdate: ({ editor: e }: { editor: Editor }) => {
      if (isUpdatingFromProp.current) return;
      const html = e.getHTML();
      // Strip wrapper tags for plain text storage if empty
      const cleanHtml = html === "<p></p>" ? "" : html;
      onChange(cleanHtml);
    },
    editorProps: {
      attributes: {
        class: cn(
          "notion-title-editor outline-none focus:outline-none min-h-[1.75rem]",
          "[&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
          "[&_.is-editor-empty:first-child]:before:text-muted-foreground/50",
          "[&_.is-editor-empty:first-child]:before:float-left",
          "[&_.is-editor-empty:first-child]:before:h-0",
          "[&_.is-editor-empty:first-child]:before:pointer-events-none",
          "[&_p]:text-xl [&_p]:font-semibold [&_p]:leading-tight",
          "[&_p]:m-0"
        ),
      },
      handleKeyDown: (_view: EditorView, event: KeyboardEvent) => {
        // Prevent Enter key to keep it single line
        if (event.key === "Enter") {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
    immediatelyRender: false,
  });

  // Sync external value changes
  useEffect(() => {
    if (
      editor &&
      value !== editor.getHTML() &&
      value !== (editor.getHTML() === "<p></p>" ? "" : editor.getHTML())
    ) {
      isUpdatingFromProp.current = true;
      editor.commands.setContent(value || "");
      isUpdatingFromProp.current = false;
    }
  }, [value, editor]);

  // Update editable state when disabled changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  return (
    <div className={cn("w-full", className)}>
      <EditorContent editor={editor} />
    </div>
  );
}

// Helper to extract plain text from HTML content
export function extractTextFromHtml(html: string | undefined): string {
  if (!html) return "";
  // Simple regex to strip HTML tags
  return html.replace(/<[^>]*>/g, "").trim();
}
