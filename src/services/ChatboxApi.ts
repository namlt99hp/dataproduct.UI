import axios from "axios";
import type { ChatResponseEnvelope } from "../types/ChatResponseContract";

// Chatbox nói chuyện thẳng với dataproduct.gateway (AI Gateway), KHÔNG qua dataproduct.api.
const chatboxHttp = axios.create({
  baseURL: import.meta.env.VITE_CHATBOX_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60_000, // Claude + vòng lặp tool-call có thể mất vài chục giây
});

export const ChatboxApi = {
  ask: async (message: string): Promise<ChatResponseEnvelope> => {
    const res = await chatboxHttp.post<ChatResponseEnvelope>("/api/chat", { message });
    return res.data;
  },
};
