"use client";

import type { Editor, Range } from "@tiptap/react";
import {
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Table,
  Type,
} from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface SlashMenuItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  command: (props: { editor: Editor; range: Range }) => void;
  category: "text" | "lists" | "blocks" | "advanced";
}

export interface SlashMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashMenuProps {
  editor: Editor;
  range: Range;
  items: SlashMenuItem[];
  command: (item: SlashMenuItem) => void;
}

export const defaultSlashMenuItems: SlashMenuItem[] = [
  {
    title: "Text",
    description: "Plain text paragraph",
    icon: <Type className="size-4" />,
    category: "text",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: "Heading 1",
    description: "Large section heading",
    icon: <Heading1 className="size-4" />,
    category: "text",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: <Heading2 className="size-4" />,
    category: "text",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: <Heading3 className="size-4" />,
    category: "text",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: "Bullet List",
    description: "Simple bullet list",
    icon: <List className="size-4" />,
    category: "lists",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered List",
    description: "Numbered list with order",
    icon: <ListOrdered className="size-4" />,
    category: "lists",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Task List",
    description: "Checklist with checkboxes",
    icon: <ListChecks className="size-4" />,
    category: "lists",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Quote",
    description: "Capture a quote",
    icon: <Quote className="size-4" />,
    category: "blocks",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "Code Block",
    description: "Code with syntax highlighting",
    icon: <Code className="size-4" />,
    category: "blocks",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "Divider",
    description: "Visual divider line",
    icon: <Minus className="size-4" />,
    category: "blocks",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: "Table",
    description: "Insert a table",
    icon: <Table className="size-4" />,
    category: "advanced",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
];

export const SlashMenu = forwardRef<SlashMenuRef, SlashMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command(item);
        }
      },
      [items, command]
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }

        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }

        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }));

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    if (items.length === 0) {
      return (
        <div className="rounded-lg border bg-popover p-3 text-sm text-muted-foreground shadow-lg">
          No results
        </div>
      );
    }

    return (
      <div
        className="z-50 max-h-80 w-72 overflow-y-auto overscroll-contain rounded-lg border bg-popover shadow-lg"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="p-1">
          {items.map((item, index) => (
            <button
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                index === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
              key={item.title}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
              type="button"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                {item.icon}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="truncate text-sm font-medium">{item.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {item.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }
);

SlashMenu.displayName = "SlashMenu";
