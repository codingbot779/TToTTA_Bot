import { Chat } from "@/components/Chat";
import { getModelCatalog } from "@/lib/model-catalog";
import { listSearchableCategories } from "@/lib/document-categories";
import { createClient } from "@/lib/supabase/server";

export default async function NewChatPage() {
  const categories = await listSearchableCategories(await createClient());
  // 새 채팅으로 이동할 때마다 대화 상태를 초기화
  return (
    <Chat
      key={crypto.randomUUID()}
      roomId={null}
      initialMessages={[]}
      catalog={await getModelCatalog()}
      categories={categories}
    />
  );
}
