import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type TextStreamPart,
  type ToolSet,
} from "ai";
import { createClient } from "@/lib/supabase/server";
import { getModel, isModelKey } from "@/lib/models";
import { retrieveDocuments } from "@/lib/rag";
import { extractWebSources, getTavilyTools } from "@/lib/tavily-mcp";
import type { ChatMessage, Source } from "@/lib/types";

export const maxDuration = 60;

type ChatRequest = {
  messages: ChatMessage[];
  model: unknown;
  roomId?: string | null;
};

const textOf = (message: ChatMessage) =>
  message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");

function buildSystemPrompt(context: string) {
  const today = new Date().toLocaleDateString("ko-KR", { dateStyle: "full", timeZone: "Asia/Seoul" });
  return `당신은 'TToTA AI'입니다. 사용자의 질문에 한국어로 친절하고 정확하게 답변합니다.
오늘 날짜: ${today}

[답변 원칙]
1. 아래 [참고 문서]에 관련 내용이 있으면 이를 최우선 근거로 답변하세요.
2. 뉴스, 날씨, 주가, 최근 사건, 최신 버전 등 최신·실시간 정보가 필요하거나 참고 문서에 답이 없으면 tavily_search 도구로 웹을 검색한 뒤 그 결과를 참고해 답변하세요.
3. 근거가 없는 내용은 지어내지 말고 모른다고 말하세요.
4. 마크다운을 사용해 읽기 쉽게 정리하세요. 출처 목록은 화면에 따로 표시되므로 답변 끝에 반복하지 않아도 됩니다.

[참고 문서]
${context || "(질문과 관련된 문서를 찾지 못했습니다.)"}`;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { messages, model: modelKey, roomId: requestedRoomId }: ChatRequest = await req.json();
  if (!isModelKey(modelKey)) return Response.json({ error: "지원하지 않는 모델입니다." }, { status: 400 });

  const lastMessage = messages.at(-1);
  const question = lastMessage ? textOf(lastMessage).trim() : "";
  if (!lastMessage || lastMessage.role !== "user" || !question) {
    return Response.json({ error: "질문을 입력해 주세요." }, { status: 400 });
  }

  let model;
  try {
    model = getModel(modelKey);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }

  // 1. 채팅방 확인 또는 생성
  let roomId = requestedRoomId ?? null;
  if (roomId) {
    const { data } = await supabase.from("chat_rooms").select("id").eq("id", roomId).maybeSingle();
    if (!data) return Response.json({ error: "채팅방을 찾을 수 없습니다." }, { status: 404 });
  } else {
    const { data, error } = await supabase
      .from("chat_rooms")
      .insert({ user_id: user.id, title: question.slice(0, 40), model: modelKey })
      .select("id")
      .single();
    if (error) return Response.json({ error: `채팅방 생성 실패: ${error.message}` }, { status: 500 });
    roomId = data.id as string;
  }

  // 2. 사용자 질문 저장
  await supabase.from("messages").insert({
    room_id: roomId,
    user_id: user.id,
    role: "user",
    content: question,
    model: modelKey,
  });

  // 3. RAG: 질문 임베딩 → 관련 문서 검색
  let context = "";
  let docSources: Source[] = [];
  try {
    ({ context, sources: docSources } = await retrieveDocuments(supabase, question));
  } catch (error) {
    console.error("[RAG]", error);
  }

  // 4. Tavily MCP 웹검색 툴 준비
  const tavily = await getTavilyTools();
  const webSources: Source[] = [];
  const allSources = () => [...docSources, ...webSources];

  // 텍스트만 모델에 전달 (모델을 바꿔가며 대화해도 호환되도록)
  const history = messages.map((m) => ({
    role: m.role,
    parts: [{ type: "text" as const, text: textOf(m) }],
  }));

  const result = streamText({
    model,
    system: buildSystemPrompt(context),
    messages: await convertToModelMessages(history),
    tools: tavily.tools,
    stopWhen: stepCountIs(5),
    onEnd: async () => {
      await tavily.close().catch(() => {});
    },
    onError: async ({ error }) => {
      console.error("[LLM]", error);
      await tavily.close().catch(() => {});
    },
  });

  // 웹검색 결과에서 출처(URL)를 수집하면서 그대로 흘려보낸다
  const tapped = result.stream.pipeThrough(
    new TransformStream<TextStreamPart<ToolSet>, TextStreamPart<ToolSet>>({
      transform(part, controller) {
        if (part.type === "tool-result") {
          for (const s of extractWebSources(part.output)) {
            if (!webSources.some((w) => w.type === "web" && s.type === "web" && w.url === s.url)) {
              webSources.push(s);
            }
          }
        }
        controller.enqueue(part);
      },
    }),
  );

  const createdAt = new Date().toISOString();

  return createUIMessageStreamResponse({
    stream: toUIMessageStream<ToolSet, ChatMessage>({
      stream: tapped,
      originalMessages: messages,
      messageMetadata: ({ part }) => {
        if (part.type === "start") return { createdAt, model: modelKey, roomId: roomId!, sources: docSources };
        if (part.type === "finish") return { sources: allSources() };
      },
      onError: (error) => (error instanceof Error ? error.message : "답변 생성 중 오류가 발생했습니다."),
      onEnd: async ({ responseMessage }) => {
        // 5. AI 답변 + 참고 출처 저장
        const answer = textOf(responseMessage).trim();
        if (answer) {
          await supabase.from("messages").insert({
            room_id: roomId,
            user_id: user.id,
            role: "assistant",
            content: answer,
            sources: allSources(),
            model: modelKey,
          });
        }
        await supabase
          .from("chat_rooms")
          .update({ updated_at: new Date().toISOString(), model: modelKey })
          .eq("id", roomId);
      },
    }),
  });
}
