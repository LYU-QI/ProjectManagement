import { apiPost } from './client';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatResponse {
    content: string;
}

export async function chatWithAi(message: string, history?: ChatMessage[]): Promise<ChatResponse> {
    return apiPost<ChatResponse>('/ai/chat', { message, history });
}

export async function getDashboardSummary(projectId?: number): Promise<{ report: string }> {
    return apiPost<{ report: string }>('/ai/dashboard/summary', { projectId });
}
