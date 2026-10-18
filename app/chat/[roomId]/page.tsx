import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Chat } from "@/components/Chat";
import { getAvailableModels } from "@/lib/models";
import type { ChatMessage, ModelKey, Source } from "@/lib/types";

type MessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[] | null;
  model: ModelKey | null;
  created_at: string;
};

export default async function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = await createClient();

  const { data: room } = await supabase.from("chat_rooms").select("id, model").eq("id", roomId).maybeSingle();
  if (!room) notFound();

  const { data } = await supabase
    .from("messages")
    .select("id, role, content, sources, model, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  const initialMessages: ChatMessage[] = ((data ?? []) as MessageRow[]).map((m) => ({
    id: m.id,
    role: m.role,
    parts: [{ type: "text", text: m.content }],
    metadata: {
      createdAt: m.created_at,
      model: m.model ?? undefined,
      sources: m.sources ?? [],
    },
  }));

  return (
    <Chat
      key={roomId}
      roomId={roomId}
      initialMessages={initialMessages}
      initialModel={room.model}
      availableModels={getAvailableModels()}
    />
  );
}
