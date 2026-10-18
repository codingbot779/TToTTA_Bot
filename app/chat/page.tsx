import { Chat } from "@/components/Chat";
import { getAvailableModels } from "@/lib/models";

export default function NewChatPage() {
  // 새 채팅으로 이동할 때마다 대화 상태를 초기화
  return (
    <Chat key={crypto.randomUUID()} roomId={null} initialMessages={[]} availableModels={getAvailableModels()} />
  );
}
