// Message handling utilities for agent

import type { AgentMessage, ConversationMessage } from './types';

// Build conversation history from messages
export function buildConversationHistory(
  initialPrompt: string,
  messages: AgentMessage[]
): ConversationMessage[] {
  const history: ConversationMessage[] = [];

  // Add initial user prompt
  if (initialPrompt) {
    history.push({ role: 'user', content: initialPrompt });
  }

  // Process messages to build conversation
  let currentAssistantContent = '';

  for (const msg of messages) {
    if (msg.type === 'user') {
      // Before adding user message, flush any accumulated assistant content
      if (currentAssistantContent) {
        history.push({
          role: 'assistant',
          content: currentAssistantContent.trim(),
        });
        currentAssistantContent = '';
      }

      // Extract image paths from attachments if present
      const imagePaths = msg.attachments
        ?.filter((a) => a.type === 'image' && a.path)
        .map((a) => a.path as string);

      history.push({
        role: 'user',
        content: msg.content || '',
        imagePaths:
          imagePaths && imagePaths.length > 0 ? imagePaths : undefined,
      });
    } else if (msg.type === 'text') {
      // Accumulate assistant text
      currentAssistantContent += (msg.content || '') + '\n';
    } else if (msg.type === 'tool_use') {
      // Include tool use as part of assistant's response
      currentAssistantContent += `[Used tool: ${msg.name}]\n`;
    }
  }

  // Flush remaining assistant content
  if (currentAssistantContent) {
    history.push({
      role: 'assistant',
      content: currentAssistantContent.trim(),
    });
  }

  return history;
}
