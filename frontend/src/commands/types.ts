export interface EditorCommand {
  name: string;
  execute: () => void;
  undo: () => void;
}
