"use client";

import type { Editor } from "@tiptap/react";
import {
  EditorContent,
  Extension,
  ReactRenderer,
  useEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Suggestion from "@tiptap/suggestion";
import tippy from "tippy.js";
import type { Instance, Props as TippyProps } from "tippy.js";
import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { FloatingToolbar } from "./floating-toolbar";
import {
  SlashMenu,
  defaultSlashMenuItems,
  type SlashMenuItem,
  type SlashMenuRef,
} from "./slash-menu";

interface BlockEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// Custom slash command extension
const SlashCommands = Extension.create({
  name: "slashCommands",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: { from: number; to: number };
          props: SlashMenuItem;
        }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export function BlockEditor({
  value,
  onChange,
  placeholder = "Type '/' for commands...",
  disabled = false,
  className,
}: BlockEditorProps) {
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
        codeBlock: {
          HTMLAttributes: {
            class: "block-editor-code-block",
          },
        },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") {
            const level = node.attrs.level;
            return `Heading ${level}`;
          }
          if (node.type.name === "paragraph") {
            return placeholder;
          }
          return "";
        },
        showOnlyCurrent: false,
        includeChildren: true,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "block-editor-link",
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: "block-editor-task-list",
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "block-editor-task-item",
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "block-editor-table",
        },
      }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({
        HTMLAttributes: {
          class: "block-editor-image",
        },
      }),
      SlashCommands.configure({
        suggestion: {
          char: "/",
          items: ({ query }: { query: string }) => {
            return defaultSlashMenuItems.filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase())
            );
          },
          render: () => {
            let component: ReactRenderer<SlashMenuRef> | null = null;
            let popup: Instance[] | null = null;

            return {
              onStart: (props: {
                editor: Editor;
                clientRect: (() => DOMRect | null) | null;
              }) => {
                component = new ReactRenderer(SlashMenu, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) {
                  return;
                }

                const clientRectFn = props.clientRect;
                popup = tippy("body", {
                  getReferenceClientRect: () =>
                    clientRectFn() ?? new DOMRect(0, 0, 0, 0),
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                  touch: ["hold", 500],
                  popperOptions: {
                    modifiers: [
                      {
                        name: "preventOverflow",
                        options: {
                          padding: 8,
                        },
                      },
                    ],
                  },
                });
              },

              onUpdate(props: {
                editor: Editor;
                clientRect: (() => DOMRect | null) | null;
              }) {
                component?.updateProps(props);

                if (!props.clientRect) {
                  return;
                }

                const clientRectFn = props.clientRect;
                popup?.[0]?.setProps({
                  getReferenceClientRect: () =>
                    clientRectFn() ?? new DOMRect(0, 0, 0, 0),
                });
              },

              onKeyDown(props: { event: KeyboardEvent }) {
                if (props.event.key === "Escape") {
                  popup?.[0]?.hide();
                  return true;
                }

                return component?.ref?.onKeyDown(props) ?? false;
              },

              onExit() {
                popup?.[0]?.destroy();
                component?.destroy();
              },
            };
          },
        },
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
          "block-editor outline-none focus:outline-none min-h-[8rem]",
          // Empty placeholder styles for all empty nodes (excluding table cells)
          "[&_.is-empty:not(th):not(td)]:before:content-[attr(data-placeholder)]",
          "[&_.is-empty:not(th):not(td)]:before:text-muted-foreground/40",
          "[&_.is-empty:not(th):not(td)]:before:float-left",
          "[&_.is-empty:not(th):not(td)]:before:h-0",
          "[&_.is-empty:not(th):not(td)]:before:pointer-events-none",
          // Also support is-editor-empty for first node (excluding table cells)
          "[&_.is-editor-empty:not(th):not(td)]:before:content-[attr(data-placeholder)]",
          "[&_.is-editor-empty:not(th):not(td)]:before:text-muted-foreground/40",
          "[&_.is-editor-empty:not(th):not(td)]:before:float-left",
          "[&_.is-editor-empty:not(th):not(td)]:before:h-0",
          "[&_.is-editor-empty:not(th):not(td)]:before:pointer-events-none",
          // Paragraph styles
          "[&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-foreground",
          "[&_p]:m-0 [&_p]:mb-2 [&_p:last-child]:mb-0",
          // Heading styles
          "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-6 [&_h1:first-child]:mt-0",
          "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2:first-child]:mt-0",
          "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3:first-child]:mt-0",
          // List styles
          "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3",
          "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3",
          "[&_li]:text-sm [&_li]:text-foreground [&_li]:mb-1",
          "[&_li_p]:mb-0",
          // Task list styles
          "[&_.block-editor-task-list]:list-none [&_.block-editor-task-list]:pl-0",
          "[&_.block-editor-task-item]:flex [&_.block-editor-task-item]:items-start [&_.block-editor-task-item]:gap-2 [&_.block-editor-task-item]:mb-1",
          "[&_.block-editor-task-item_input]:mt-1 [&_.block-editor-task-item_input]:cursor-pointer",
          "[&_.block-editor-task-item_input]:size-4 [&_.block-editor-task-item_input]:rounded [&_.block-editor-task-item_input]:border [&_.block-editor-task-item_input]:border-muted-foreground/40",
          "[&_.block-editor-task-item[data-checked=true]]:line-through [&_.block-editor-task-item[data-checked=true]]:text-muted-foreground",
          // Text formatting styles
          "[&_strong]:font-bold [&_strong]:text-foreground",
          "[&_em]:italic",
          "[&_u]:underline",
          "[&_s]:line-through",
          "[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_code]:text-foreground",
          // Blockquote styles
          "[&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-3 [&_blockquote]:text-muted-foreground",
          // Code block styles
          "[&_.block-editor-code-block]:bg-muted [&_.block-editor-code-block]:rounded-lg [&_.block-editor-code-block]:p-4 [&_.block-editor-code-block]:my-3",
          "[&_.block-editor-code-block]:font-mono [&_.block-editor-code-block]:text-sm [&_.block-editor-code-block]:overflow-x-auto",
          "[&_.block-editor-code-block_code]:bg-transparent [&_.block-editor-code-block_code]:p-0",
          // Horizontal rule styles
          "[&_hr]:border-muted-foreground/20 [&_hr]:my-4",
          // Link styles
          "[&_.block-editor-link]:text-primary [&_.block-editor-link]:underline [&_.block-editor-link]:underline-offset-2",
          "[&_.block-editor-link:hover]:text-primary/80 [&_.block-editor-link]:cursor-pointer",
          // Table styles
          "[&_.block-editor-table]:w-full [&_.block-editor-table]:border-collapse [&_.block-editor-table]:my-3 [&_.block-editor-table]:border [&_.block-editor-table]:border-border [&_.block-editor-table]:rounded-md [&_.block-editor-table]:overflow-hidden",
          "[&_.block-editor-table_th]:border [&_.block-editor-table_th]:border-border [&_.block-editor-table_th]:border-solid [&_.block-editor-table_th]:border-[1px] [&_.block-editor-table_th]:px-4 [&_.block-editor-table_th]:py-3 [&_.block-editor-table_th]:bg-muted [&_.block-editor-table_th]:font-semibold [&_.block-editor-table_th]:text-left [&_.block-editor-table_th]:text-sm [&_.block-editor-table_th]:min-w-[100px]",
          "[&_.block-editor-table_td]:border [&_.block-editor-table_td]:border-border [&_.block-editor-table_td]:border-solid [&_.block-editor-table_td]:border-[1px] [&_.block-editor-table_td]:px-4 [&_.block-editor-table_td]:py-3 [&_.block-editor-table_td]:text-sm [&_.block-editor-table_td]:min-w-[100px]",
          "[&_.block-editor-table_th.is-empty]:before:content-none [&_.block-editor-table_th.is-empty]:before:hidden",
          "[&_.block-editor-table_td.is-empty]:before:content-none [&_.block-editor-table_td.is-empty]:before:hidden",
          // Image styles
          "[&_.block-editor-image]:max-w-full [&_.block-editor-image]:h-auto [&_.block-editor-image]:rounded-lg [&_.block-editor-image]:my-3"
        ),
      },
    },
    immediatelyRender: false,
  });

  // Sync external value changes
  const syncContent = useCallback(() => {
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

  useEffect(() => {
    syncContent();
  }, [syncContent]);

  // Update editable state when disabled changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  return (
    <div
      className={cn(
        "relative w-full",
        disabled && "opacity-60 cursor-not-allowed",
        className
      )}
    >
      {editor && !disabled && <FloatingToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

// Helper to extract plain text from HTML content
export function extractBlockEditorText(
  html: string | undefined,
  maxLength?: number
): string {
  if (!html) return "";
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (maxLength && text.length > maxLength) {
    return text.substring(0, maxLength) + "...";
  }
  return text;
}
