"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "./Logo";
import { ThemeControl } from "./ThemeProvider";
import type { ChatRoom } from "@/lib/types";

export const ROOMS_CHANGED_EVENT = "ttota:rooms-changed";

type Profile = { name: string; avatarUrl: string | null; email: string };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Sidebar({
  initialRooms,
  profile,
  isAdmin,
}: {
  initialRooms: ChatRoom[];
  profile: Profile;
  isAdmin: boolean;
}) {
  const [rooms, setRooms] = useState(initialRooms);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const activeId = pathname.startsWith("/chat/") ? pathname.split("/")[2] : null;

  const reload = useCallback(async () => {
    const { data } = await createClient()
      .from("chat_rooms")
      .select("id, title, model, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (data) setRooms(data as ChatRoom[]);
  }, []);

  useEffect(() => {
    window.addEventListener(ROOMS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(ROOMS_CHANGED_EVENT, reload);
  }, [reload]);

  // 모바일에서 페이지 이동 시 사이드바 닫기
  useEffect(() => setOpen(false), [pathname]);

  const deleteRoom = async (id: string) => {
    if (!confirm("이 대화를 삭제할까요?")) return;
    await createClient().from("chat_rooms").delete().eq("id", id);
    setRooms((prev) => prev.filter((r) => r.id !== id));
    if (id === activeId) router.push("/chat");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-30 flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface md:hidden"
        aria-label="메뉴 열기"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        </svg>
      </button>
      {open && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-sidebar transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 px-4 pb-3 pt-4">
          <LogoMark className="h-6 w-6" />
          <span className="text-lg font-medium tracking-tight">TToTA AI</span>
        </div>

        <div className="px-3">
          <Link
            href="/chat"
            className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium transition hover:border-muted"
          >
            <span className="flex h-6 w-6 items-center justify-center text-foreground">+</span>
            새 채팅
          </Link>
          {isAdmin && (
            <Link
              href="/documents"
              className={`mt-0.5 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname === "/documents" ? "bg-surface" : "hover:bg-surface"
              }`}
            >
              <span className="flex h-6 w-6 items-center justify-center text-base">📚</span>
              문서 관리
            </Link>
          )}
        </div>

        <div className="eyebrow mt-8 px-5 text-muted">최근 대화 / HISTORY</div>
        <nav className="mt-1 flex-1 overflow-y-auto px-3 pb-3">
          {rooms.length === 0 && <p className="px-3 py-2 text-sm text-muted">아직 대화가 없습니다.</p>}
          {rooms.map((room) => (
            <div
              key={room.id}
              className={`group relative rounded-lg transition ${
                room.id === activeId ? "bg-surface" : "hover:bg-surface"
              }`}
            >
              <Link href={`/chat/${room.id}`} className="block px-3 py-2 pr-8">
                <div className="truncate text-sm">{room.title}</div>
                <div className="mt-0.5 text-[11px] text-muted">{formatDate(room.created_at)}</div>
              </Link>
              <button
                onClick={() => deleteRoom(room.id)}
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-muted transition hover:text-foreground focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                aria-label="대화 삭제"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ))}
        </nav>

        <div className="border-t border-border px-4 py-3">
          <p className="mb-2 text-xs text-muted">화면 테마</p>
          <ThemeControl />
        </div>
        <div className="flex items-center gap-3 border-t border-border p-3">
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt={profile.name}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-sm font-medium">
              {profile.name.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{profile.name}</div>
            <div className="truncate text-xs text-muted">{profile.email}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button
              className="min-h-11 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted transition hover:bg-surface hover:text-foreground"
              title="로그아웃"
            >
              로그아웃
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
