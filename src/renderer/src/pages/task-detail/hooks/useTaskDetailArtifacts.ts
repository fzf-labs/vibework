import { useCallback, useEffect, useRef, useState } from 'react';

import { hasValidSearchResults, type Artifact } from '@/components/artifacts';
import { getArtifactTypeFromExt } from '@/components/task';
import type { AgentMessage } from '@/hooks/useAgent';

import type { ExecutionStatus } from '../types';
import { extractFilePaths, hasFilePathMatch } from '../utils/artifacts';

interface UseTaskDetailArtifactsInput {
  taskId?: string;
  messages: AgentMessage[];
  isRunning: boolean;
  cliStatus: ExecutionStatus;
}

export function useTaskDetailArtifacts({
  taskId,
  messages,
  isRunning,
  cliStatus,
}: UseTaskDetailArtifactsInput) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [workspaceRefreshToken, setWorkspaceRefreshToken] = useState(0);

  const lastWorkspaceRefreshMessageIndexRef = useRef(0);
  const prevRunStateRef = useRef<{
    isRunning: boolean;
    cliStatus: ExecutionStatus;
  }>({ isRunning: false, cliStatus: 'idle' });
  const prevTaskIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (prevTaskIdRef.current !== taskId) {
      if (prevTaskIdRef.current !== undefined) {
        setIsPreviewVisible(false);
        setSelectedArtifact(null);
        setArtifacts([]);
        lastWorkspaceRefreshMessageIndexRef.current = 0;
        setWorkspaceRefreshToken(0);
      }
      prevTaskIdRef.current = taskId;
    }
  }, [taskId]);

  const handleSelectArtifact = useCallback((artifact: Artifact | null) => {
    setSelectedArtifact(artifact);
    if (artifact) {
      setIsPreviewVisible(true);
    }
  }, []);

  const handleClosePreview = useCallback(() => {
    setSelectedArtifact(null);
  }, []);

  useEffect(() => {
    const loadArtifacts = async () => {
      const extractedArtifacts: Artifact[] = [];
      const seenPaths = new Set<string>();

      messages.forEach((msg) => {
        if (msg.type === 'tool_use' && msg.name === 'Write') {
          const input = msg.input as Record<string, unknown> | undefined;
          const filePath = input?.file_path as string | undefined;
          const content = input?.content as string | undefined;

          if (filePath && !seenPaths.has(filePath)) {
            seenPaths.add(filePath);
            const filename = filePath.split('/').pop() || filePath;
            const ext = filename.split('.').pop()?.toLowerCase();

            extractedArtifacts.push({
              id: filePath,
              name: filename,
              type: getArtifactTypeFromExt(ext),
              content,
              path: filePath,
            });
          }
        }

        if (msg.type === 'tool_use' && msg.name === 'WebSearch') {
          const input = msg.input as Record<string, unknown> | undefined;
          const query = input?.query as string | undefined;
          const toolUseId = msg.id;
          if (query) {
            let output = '';
            if (toolUseId) {
              const resultMsg = messages.find(
                (m) => m.type === 'tool_result' && m.toolUseId === toolUseId
              );
              output = resultMsg?.output || '';
            }
            if (!output) {
              const msgIndex = messages.indexOf(msg);
              for (let i = msgIndex + 1; i < messages.length; i++) {
                if (messages[i].type === 'tool_result') {
                  output = messages[i].output || '';
                  break;
                }
                if (messages[i].type === 'tool_use') break;
              }
            }

            const artifactId = `websearch-${query}`;
            if (!seenPaths.has(artifactId) && output && hasValidSearchResults(output)) {
              seenPaths.add(artifactId);
              extractedArtifacts.push({
                id: artifactId,
                name: `Search: ${query.slice(0, 50)}${query.length > 50 ? '...' : ''}`,
                type: 'websearch',
                content: output,
              });
            }
          }
        }
      });

      messages.forEach((msg) => {
        const textToSearch =
          msg.type === 'tool_result'
            ? msg.output
            : msg.type === 'text'
              ? msg.content
              : null;

        if (textToSearch) {
          const filePaths = extractFilePaths(textToSearch);
          for (const filePath of filePaths) {
            if (filePath && !seenPaths.has(filePath)) {
              seenPaths.add(filePath);
              const filename = filePath.split('/').pop() || filePath;
              const ext = filename.split('.').pop()?.toLowerCase();

              extractedArtifacts.push({
                id: filePath,
                name: filename,
                type: getArtifactTypeFromExt(ext),
                path: filePath,
              });
            }
          }
        }
      });

      setArtifacts(extractedArtifacts);
    };

    void loadArtifacts();
  }, [messages, taskId]);

  useEffect(() => {
    if (messages.length < lastWorkspaceRefreshMessageIndexRef.current) {
      lastWorkspaceRefreshMessageIndexRef.current = 0;
    }
    if (messages.length === 0) return;
    const startIndex = lastWorkspaceRefreshMessageIndexRef.current;
    if (startIndex >= messages.length) return;

    const newMessages = messages.slice(startIndex);
    lastWorkspaceRefreshMessageIndexRef.current = messages.length;

    let shouldRefresh = false;
    for (const msg of newMessages) {
      if (msg.type === 'tool_use' && msg.name === 'Write') {
        shouldRefresh = true;
        break;
      }
      const textToSearch =
        msg.type === 'tool_result'
          ? msg.output
          : msg.type === 'text'
            ? msg.content
            : null;
      if (textToSearch && hasFilePathMatch(textToSearch)) {
        shouldRefresh = true;
        break;
      }
    }

    if (shouldRefresh) {
      setWorkspaceRefreshToken((prev) => prev + 1);
    }
  }, [messages]);

  useEffect(() => {
    const prev = prevRunStateRef.current;
    const wasRunning = prev.isRunning || prev.cliStatus === 'running';
    const isNowRunning = isRunning || cliStatus === 'running';
    if (wasRunning && !isNowRunning) {
      setWorkspaceRefreshToken((prevToken) => prevToken + 1);
    }
    prevRunStateRef.current = { isRunning, cliStatus };
  }, [cliStatus, isRunning]);

  return {
    artifacts,
    selectedArtifact,
    isPreviewVisible,
    workspaceRefreshToken,
    handleSelectArtifact,
    handleClosePreview,
    setIsPreviewVisible,
  };
}
