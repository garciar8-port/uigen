import { tool } from "ai";
import { z } from "zod";
import { VirtualFileSystem } from "@/lib/file-system";

export const buildStrReplaceTool = (fileSystem: VirtualFileSystem) => {
  return tool({
    description:
      "A text editor tool for viewing, creating, and editing files. Use 'view' to read files, 'create' to make new files, 'str_replace' to replace text, and 'insert' to add new lines.",
    inputSchema: z.object({
      command: z
        .enum(["view", "create", "str_replace", "insert", "undo_edit"])
        .describe("The editing command to execute"),
      path: z.string().describe("The file path to operate on"),
      file_text: z
        .string()
        .optional()
        .describe("The content for creating a new file (used with 'create' command)"),
      insert_line: z
        .number()
        .optional()
        .describe("The line number to insert at (used with 'insert' command)"),
      new_str: z
        .string()
        .optional()
        .describe("The new string to insert or replace with"),
      old_str: z
        .string()
        .optional()
        .describe("The string to be replaced (used with 'str_replace' command)"),
      view_range: z
        .array(z.number())
        .optional()
        .describe("Line range to view as [start, end] (used with 'view' command)"),
    }),
    execute: async ({
      command,
      path,
      file_text,
      insert_line,
      new_str,
      old_str,
      view_range,
    }) => {
      switch (command) {
        case "view":
          return fileSystem.viewFile(
            path,
            view_range as [number, number] | undefined
          );

        case "create":
          return fileSystem.createFileWithParents(path, file_text || "");

        case "str_replace":
          return fileSystem.replaceInFile(path, old_str || "", new_str || "");

        case "insert":
          return fileSystem.insertInFile(path, insert_line || 0, new_str || "");

        case "undo_edit":
          return `Error: undo_edit command is not supported in this version. Use str_replace to revert changes.`;
      }
    },
  });
};
