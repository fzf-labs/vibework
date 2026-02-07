import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { useAgent, type MessageAttachment } from '@/hooks/useAgent';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/providers/language-provider';
import { AppSidebar, useSidebar } from '@/components/layout';
import { ToolSelectionContext } from '@/components/task';

import { ExecutionPanel } from './components/ExecutionPanel';
import { ReplyCard } from './components/ReplyCard';
import { RightPanelSection } from './components/RightPanelSection';
import { TaskCard } from './components/TaskCard';
import { TaskDialogs } from './components/TaskDialogs';
import { WorkflowCard } from './components/WorkflowCard';
import { useTaskDetail } from './useTaskDetail';
import type { LocationState } from './types';

export function TaskDetailContainer() {
  const { t } = useLanguage();
  const { taskId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;
  const initialPrompt = state?.prompt || '';
  const initialSessionId = state?.sessionId;
  const initialAttachments = state?.attachments;

  const {
    taskId: activeTaskId,
    messages,
    setMessages,
    isRunning,
    stopAgent,
    runAgent,
    continueConversation,
    loadTask,
    loadMessages,
    phase,
    approvePlan,
    rejectPlan,
    sessionFolder,
  } = useAgent();
  const { toggleLeft } = useSidebar();

  const containerRef = useRef<HTMLDivElement>(null);
  const initialAttachmentsRef = useRef<MessageAttachment[] | undefined>(
    initialAttachments
  );

  useEffect(() => {
    initialAttachmentsRef.current = initialAttachments;
  }, [initialAttachments]);

  // Single consolidated hook for all task detail logic
  const detail = useTaskDetail({
    taskId,
    initialPrompt,
    initialSessionId,
    initialAttachmentsRef,
    navigate,
    activeTaskId,
    messages,
    setMessages,
    isRunning,
    stopAgent,
    runAgent,
    continueConversation,
    loadTask,
    loadMessages,
    sessionFolder,
    t,
  });

  const handleAction = detail.isCliTaskReviewPending
    ? detail.handleApproveCliTask
    : detail.handleStartTask;
  const cliSessionId = detail.task?.session_id || '';
  const cliToolId = detail.task?.cli_tool_id || '';

  return (
    <ToolSelectionContext.Provider value={detail.toolSelectionValue}>
      <div className="bg-sidebar flex h-screen overflow-hidden">
        <AppSidebar />

        <div
          ref={containerRef}
          className="bg-background my-2 mr-2 flex min-w-0 flex-1 overflow-hidden rounded-2xl shadow-sm"
        >
          <div
            className={cn(
              'bg-background flex min-w-0 flex-col overflow-hidden transition-all duration-200',
              !detail.isPreviewVisible && 'rounded-2xl',
              detail.isPreviewVisible && 'rounded-l-2xl'
            )}
            style={{
              flex: detail.isPreviewVisible ? '0 0 auto' : '1 1 0%',
              width: detail.isPreviewVisible ? 'clamp(320px, 40%, 500px)' : undefined,
              minWidth: '320px',
              maxWidth: detail.isPreviewVisible ? '500px' : undefined,
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
              <TaskCard
                t={t}
                title={detail.displayTitle || `Task ${taskId}`}
                metaRows={detail.visibleMetaRows}
                showActionButton={detail.showActionButton}
                actionDisabled={detail.actionDisabled}
                actionLabel={detail.actionLabel}
                onAction={handleAction}
                onToggleSidebar={toggleLeft}
                onEdit={detail.handleOpenEdit}
                onDelete={() => detail.setIsDeleteOpen(true)}
                canEdit={detail.task?.status === 'todo'}
              />

              {detail.showWorkflowCard && (
                <WorkflowCard
                  t={t}
                  nodes={detail.workflowNodesForDisplay}
                  templateNodeMap={detail.workflowTemplateNodeMap}
                  currentWorkNode={detail.currentWorkNode}
                  onApproveCurrent={detail.handleApproveWorkNode}
                />
              )}

              <ExecutionPanel
                t={t}
                isLoading={detail.isLoading}
                pipelineBanner={detail.pipelineBanner}
                useCliSession={detail.useCliSession}
                cliStatusInfo={detail.cliStatusInfo}
                cliToolLabel={detail.cliToolLabel}
                messages={messages}
                phase={phase}
                onApprovePlan={approvePlan}
                onRejectPlan={rejectPlan}
                isRunning={isRunning}
                taskId={taskId ?? null}
                sessionId={cliSessionId}
                toolId={cliToolId}
                configId={detail.agentToolConfigId}
                workingDir={detail.workingDir}
                prompt={detail.taskPrompt}
                cliSessionRef={detail.cliSessionRef}
                onCliStatusChange={detail.handleCliStatusChange}
                messagesContainerRef={detail.messagesContainerRef}
                messagesEndRef={detail.messagesEndRef}
              />

              <ReplyCard
                t={t}
                isRunning={detail.replyIsRunning}
                onStop={detail.handleStopExecution}
                onSubmit={detail.handleReply}
              />
            </div>
          </div>

          {detail.isPreviewVisible && <div className="bg-border/50 w-px shrink-0" />}

          <RightPanelSection
            isVisible={detail.isPreviewVisible}
            taskId={taskId ?? null}
            workingDir={detail.workingDir}
            branchName={detail.task?.branch_name || null}
            baseBranch={detail.task?.base_branch || null}
            selectedArtifact={detail.selectedArtifact}
            artifacts={detail.artifacts}
            onSelectArtifact={detail.handleSelectArtifact}
            workspaceRefreshToken={detail.workspaceRefreshToken}
            onClosePreview={detail.handleClosePreview}
          />
        </div>
      </div>

      <TaskDialogs
        t={t}
        isEditOpen={detail.isEditOpen}
        setIsEditOpen={detail.setIsEditOpen}
        editPrompt={detail.editPrompt}
        setEditPrompt={detail.setEditPrompt}
        editCliToolId={detail.editCliToolId}
        setEditCliToolId={detail.setEditCliToolId}
        editCliConfigId={detail.editCliConfigId}
        setEditCliConfigId={detail.setEditCliConfigId}
        cliTools={detail.cliTools}
        cliConfigs={detail.cliConfigs}
        onSaveEdit={detail.handleSaveEdit}
        isDeleteOpen={detail.isDeleteOpen}
        setIsDeleteOpen={detail.setIsDeleteOpen}
        onDelete={detail.handleDeleteTask}
      />
    </ToolSelectionContext.Provider>
  );
}
