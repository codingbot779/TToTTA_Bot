import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { isAdmin } from "@/lib/admin";
import type { ChatRoom } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: rooms } = await supabase
    .from("chat_rooms")
    .select("id, title, model, created_at, updated_at")
    .order("updated_at", { ascending: false });

  const meta = user.user_metadata ?? {};
  const profile = {
    name: (meta.full_name || meta.name || user.email || "사용자") as string,
    avatarUrl: (meta.avatar_url || meta.picture || null) as string | null,
    email: user.email ?? "",
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar initialRooms={(rooms ?? []) as ChatRoom[]} profile={profile} isAdmin={isAdmin(user)} />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
