import type { UIMessage } from "ai";

export type ModelKey = "claude" | "chatgpt" | "gemini";

export type Source =
  | { type: "doc"; title: string; similarity?: number }
  | { type: "web"; title: string; url: string };

export type ChatMetadata = {
  createdAt?: string;
  model?: ModelKey;
  modelId?: string;
  roomId?: string;
  sources?: Source[];
};

export type ChatMessage = UIMessage<ChatMetadata>;

export type ChatRoom = {
  id: string;
  title: string;
  model: string | null;
  created_at: string;
  updated_at: string;
};
