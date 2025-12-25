"use client";

import type { Editor } from "@tiptap/react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface NotionDescriptionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function NotionDescriptionEditor({
  value,
  onChange,
  placeholder = "Add a description...",
  disabled = false,
  className,
}: NotionDescriptionEditorProps) {
  const isUpdatingFromProp = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content: value || "",
    editable: !disabled,
    onUpdate: ({ editor: e }: { editor: Editor }) => {
      if (isUpdatingFromProp.current) return;
      const html = e.getHTML();
      const cleanHtml = html === "<p></p>" ? "" : html;
      onChange(cleanHtml);
    },
    editorProps: {
      attributes: {
        class: cn(
          "notion-description-editor outline-none focus:outline-none min-h-[4rem]",
          "[&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
          "[&_.is-editor-empty:first-child]:before:text-muted-foreground/50",
          "[&_.is-editor-empty:first-child]:before:float-left",
          "[&_.is-editor-empty:first-child]:before:h-0",
          "[&_.is-editor-empty:first-child]:before:pointer-events-none",
          "[&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground",
          "[&_p]:m-0 [&_p]:mb-2 [&_p:last-child]:mb-0",
          "[&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mb-2 [&_h1]:mt-4 [&_h1:first-child]:mt-0",
          "[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3 [&_h2:first-child]:mt-0",
          "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1.5 [&_h3]:mt-2 [&_h3:first-child]:mt-0",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2",
          "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2",
          "[&_li]:text-sm [&_li]:text-muted-foreground [&_li]:mb-0.5",
          "[&_strong]:font-semibold [&_strong]:text-foreground",
          "[&_em]:italic",
          "[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono",
          "[&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-2"
        ),
      },
    },
    immediatelyRender: false,
  });

  // Sync external value changes
  useEffect(() => {
    if (editor) {
      const currentHtml = editor.getHTML();
      const normalizedCurrent = currentHtml === "<p></p>" ? "" : currentHtml;
      const normalizedValue = value || "";

      if (normalizedValue !== normalizedCurrent) {
        isUpdatingFromProp.current = true;
        editor.commands.setContent(normalizedValue);
        isUpdatingFromProp.current = false;
      }
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

// Helper to extract plain text from HTML content for node display
export function extractDescriptionText(
  html: string | undefined,
  maxLength?: number
): string {
  if (!html) return "";
  // Strip HTML tags
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (maxLength && text.length > maxLength) {
    return text.substring(0, maxLength) + "...";
  }
  return text;
}
