import { useCallback, useEffect, useRef } from 'react';

import type { AgentMessage } from '@/hooks/useAgent';

interface UseTaskDetailScrollInput {
  taskId?: string;
  messages: AgentMessage[];
  isLoading: boolean;
}

export function useTaskDetailScroll({ taskId, messages, isLoading }: UseTaskDetailScrollInput) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    userScrolledUpRef.current = false;
    lastScrollTopRef.current = 0;
  }, [taskId]);

  useEffect(() => {
    if (!userScrolledUpRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const checkScrollPosition = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (scrollTop < lastScrollTopRef.current && distanceFromBottom > 100) {
      userScrolledUpRef.current = true;
    }

    if (distanceFromBottom < 50) {
      userScrolledUpRef.current = false;
    }

    lastScrollTopRef.current = scrollTop;
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', checkScrollPosition);
    checkScrollPosition();

    return () => {
      container.removeEventListener('scroll', checkScrollPosition);
    };
  }, [checkScrollPosition]);

  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      requestAnimationFrame(() => {
        checkScrollPosition();
      });
    }
  }, [checkScrollPosition, isLoading, messages.length]);

  return { messagesEndRef, messagesContainerRef };
}
