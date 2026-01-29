import { useNavigate } from 'react-router-dom';
import { db } from '@/data';
import type { MessageAttachment } from '@/hooks/useAgent';
import { newUlid } from '@/lib/ids';
import { generateSessionId } from '@/lib/session';
import { useLanguage } from '@/providers/language-provider';

import { ChatInput } from '@/components/shared/ChatInput';

export function HomePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (
    text: string,
    attachments?: MessageAttachment[]
  ) => {
    if (!text.trim() && (!attachments || attachments.length === 0)) return;

    const prompt = text.trim();
    const sessionId = generateSessionId(prompt);

    try {
      await db.createSession({ id: sessionId, prompt });
    } catch (error) {
      console.error('[Home] Failed to create session:', error);
    }

    const taskId = newUlid();
    navigate(`/task/${taskId}`, {
      state: { prompt, sessionId, taskIndex: 1, attachments },
    });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-auto px-4">
      <div className="flex w-full max-w-2xl flex-col items-center gap-6">
        <h1 className="text-foreground text-center font-serif text-4xl font-normal tracking-tight md:text-5xl">
          {t.home.welcomeTitle}
        </h1>
        <ChatInput
          variant="home"
          placeholder={t.home.inputPlaceholder}
          onSubmit={handleSubmit}
          className="w-full"
          autoFocus
        />
      </div>
    </div>
  );
}
