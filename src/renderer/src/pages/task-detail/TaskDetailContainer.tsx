import { useEffect, useRef, useState } from 'react';
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
import { useTaskDetailActions } from './hooks/useTaskDetailActions';
import { useTaskDetailArtifacts } from './hooks/useTaskDetailArtifacts';
import { useTaskDetailCli } from './hooks/useTaskDetailCli';
import { useTaskDetailCliTools } from './hooks/useTaskDetailCliTools';
import { useTaskDetailDialogs } from './hooks/useTaskDetailDialogs';
import { useTaskDetailInit } from './hooks/useTaskDetailInit';
import { useTaskDetailPipeline } from './hooks/useTaskDetailPipeline';
import { useTaskDetailPrompt } from './hooks/useTaskDetailPrompt';
import { useTaskDetailScroll } from './hooks/useTaskDetailScroll';
import { useTaskDetailToolSelection } from './hooks/useTaskDetailToolSelection';
import { useTaskDetailViewState } from './hooks/useTaskDetailViewState';
import { useTaskDetailWorkflow } from './hooks/useTaskDetailWorkflow';
import { useTaskDetailWorkingDir } from './hooks/useTaskDetailWorkingDir';
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

  const {
    task,
    setTask,
    isLoading,
  } = useTaskDetailInit({
    taskId,
    initialPrompt,
    initialSessionId,
    loadTask,
    loadMessages,
    setMessages,
  });

  const useCliSession = Boolean(task?.cli_tool_id);

  const { cliTools } = useTaskDetailCliTools();

  const {
    isEditOpen,
    setIsEditOpen,
    editPrompt,
    setEditPrompt,
    editCliToolId,
    setEditCliToolId,
    editPipelineTemplateId,
    setEditPipelineTemplateId,
    pipelineTemplates,
    isDeleteOpen,
    setIsDeleteOpen,
    handleOpenEdit,
    handleSaveEdit,
    handleDeleteTask,
  } = useTaskDetailDialogs({
    task,
    taskId,
    navigate,
    setTask,
  });

  const { taskPrompt, buildCliPrompt } = useTaskDetailPrompt({
    task,
    initialPrompt,
  });

  const loadWorkflowStatusRef = useRef<() => void>(() => {});
  const resolveWorkNodePromptRef = useRef<
    (workNodeId?: string | null, nodeIndex?: number | null, templateId?: string | null) => Promise<string>
  >(async () => '');

  const {
    cliStatus,
    cliSessionRef,
    runCliPrompt,
    appendCliUserLog,
    appendCliSystemLog,
    handleCliStatusChange,
    stopCli,
  } = useTaskDetailCli({
    taskId,
    task,
    setTask,
    onExecutionStopped: () => loadWorkflowStatusRef.current?.(),
  });

  const {
    artifacts,
    selectedArtifact,
    isPreviewVisible,
    workspaceRefreshToken,
    handleSelectArtifact,
    handleClosePreview,
  } = useTaskDetailArtifacts({
    taskId,
    messages,
    isRunning,
    cliStatus,
  });

  const { workingDir } = useTaskDetailWorkingDir({
    task,
    artifacts,
    sessionFolder,
  });

  const [pipelineStageIndex, setPipelineStageIndex] = useState(0);

  const {
    pipelineTemplate,
    pipelineStatus,
    pipelineBanner,
    startPipelineStage,
    startNextPipelineStage,
  } = useTaskDetailPipeline({
    taskId,
    task,
    messages,
    setMessages,
    isRunning,
    cliStatus,
    useCliSession,
    runAgent,
    continueConversation,
    workingDir,
    buildCliPrompt,
    resolveWorkNodePrompt: (workNodeId, nodeIndex, templateId) =>
      resolveWorkNodePromptRef.current(workNodeId, nodeIndex, templateId),
    runCliPrompt,
    appendCliUserLog,
    t,
    pipelineStageIndex,
    setPipelineStageIndex,
  });

  const {
    currentWorkNode,
    workflowNodes,
    workflowCurrentNode,
    loadWorkflowStatus,
    resolveWorkNodePrompt,
    handleApproveWorkNode,
  } = useTaskDetailWorkflow({
    taskId,
    taskSessionId: task?.session_id ?? null,
    pipelineTemplate,
    useCliSession,
    isRunning,
    cliStatus,
    t,
    setPipelineStageIndex,
    setTask,
    buildCliPrompt,
    runCliPrompt,
    appendCliUserLog,
  });

  resolveWorkNodePromptRef.current = resolveWorkNodePrompt;
  loadWorkflowStatusRef.current = loadWorkflowStatus;

  const { toolSelectionValue } = useTaskDetailToolSelection({
    taskId,
    messages,
    isRunning,
  });

  const { messagesContainerRef, messagesEndRef } = useTaskDetailScroll({
    taskId,
    messages,
    isLoading,
  });

  const {
    displayTitle,
    cliToolLabel,
    cliStatusInfo,
    showActionButton,
    actionDisabled,
    actionLabel,
    isCliTaskReviewPending,
    showWorkflowCard,
    workflowTemplateNodeMap,
    workflowNodesForDisplay,
    visibleMetaRows,
    markStartedOnce,
  } = useTaskDetailViewState({
    taskId,
    task,
    initialPrompt,
    messages,
    isRunning,
    cliStatus,
    useCliSession,
    pipelineTemplate,
    pipelineStatus,
    cliTools,
    workflowNodes,
    currentWorkNode,
    t,
  });

  const {
    handleReply,
    handleStartTask,
    handleApproveCliTask,
    handleStopExecution,
    replyIsRunning,
  } = useTaskDetailActions({
    taskId,
    task,
    setTask,
    initialPrompt,
    initialAttachmentsRef,
    activeTaskId,
    setMessages,
    loadMessages,
    runAgent,
    continueConversation,
    isRunning,
    useCliSession,
    cliStatus,
    cliSessionRef,
    runCliPrompt,
    appendCliUserLog,
    appendCliSystemLog,
    pipelineTemplate,
    pipelineStatus,
    startPipelineStage,
    startNextPipelineStage,
    workingDir,
    t,
    workflowCurrentNode,
    resolveWorkNodePrompt,
    buildCliPrompt,
    stopAgent,
    stopCli,
    markStartedOnce,
  });

  const handleAction = isCliTaskReviewPending ? handleApproveCliTask : handleStartTask;
  const cliSessionId = task?.session_id || '';
  const cliToolId = task?.cli_tool_id || '';

  return (
    <ToolSelectionContext.Provider value={toolSelectionValue}>
      <div className="bg-sidebar flex h-screen overflow-hidden">
        <AppSidebar />

        <div
          ref={containerRef}
          className="bg-background my-2 mr-2 flex min-w-0 flex-1 overflow-hidden rounded-2xl shadow-sm"
        >
          <div
            className={cn(
              'bg-background flex min-w-0 flex-col overflow-hidden transition-all duration-200',
              !isPreviewVisible && 'rounded-2xl',
              isPreviewVisible && 'rounded-l-2xl'
            )}
            style={{
              flex: isPreviewVisible ? '0 0 auto' : '1 1 0%',
              width: isPreviewVisible ? 'clamp(320px, 40%, 500px)' : undefined,
              minWidth: '320px',
              maxWidth: isPreviewVisible ? '500px' : undefined,
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
              <TaskCard
                t={t}
                title={displayTitle || `Task ${taskId}`}
                metaRows={visibleMetaRows}
                showActionButton={showActionButton}
                actionDisabled={actionDisabled}
                actionLabel={actionLabel}
                onAction={handleAction}
                onToggleSidebar={toggleLeft}
                onEdit={handleOpenEdit}
                onDelete={() => setIsDeleteOpen(true)}
                canEdit={task?.status === 'todo'}
              />

              {showWorkflowCard && (
                <WorkflowCard
                  t={t}
                  nodes={workflowNodesForDisplay}
                  templateNodeMap={workflowTemplateNodeMap}
                  currentWorkNode={currentWorkNode}
                  onApproveCurrent={handleApproveWorkNode}
                />
              )}

              <ExecutionPanel
                t={t}
                isLoading={isLoading}
                pipelineBanner={pipelineBanner}
                useCliSession={useCliSession}
                cliStatusInfo={cliStatusInfo}
                cliToolLabel={cliToolLabel}
                messages={messages}
                phase={phase}
                onApprovePlan={approvePlan}
                onRejectPlan={rejectPlan}
                isRunning={isRunning}
                sessionId={cliSessionId}
                toolId={cliToolId}
                workingDir={workingDir}
                prompt={taskPrompt}
                cliSessionRef={cliSessionRef}
                onCliStatusChange={handleCliStatusChange}
                messagesContainerRef={messagesContainerRef}
                messagesEndRef={messagesEndRef}
              />

              <ReplyCard
                t={t}
                isRunning={replyIsRunning}
                onStop={handleStopExecution}
                onSubmit={handleReply}
              />
            </div>
          </div>

          {isPreviewVisible && <div className="bg-border/50 w-px shrink-0" />}

          <RightPanelSection
            isVisible={isPreviewVisible}
            taskId={taskId ?? null}
            workingDir={workingDir}
            branchName={task?.branch_name || null}
            baseBranch={task?.base_branch || null}
            selectedArtifact={selectedArtifact}
            artifacts={artifacts}
            onSelectArtifact={handleSelectArtifact}
            workspaceRefreshToken={workspaceRefreshToken}
            onClosePreview={handleClosePreview}
          />
        </div>
      </div>

      <TaskDialogs
        t={t}
        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        editPrompt={editPrompt}
        setEditPrompt={setEditPrompt}
        editCliToolId={editCliToolId}
        setEditCliToolId={setEditCliToolId}
        editPipelineTemplateId={editPipelineTemplateId}
        setEditPipelineTemplateId={setEditPipelineTemplateId}
        cliTools={cliTools}
        pipelineTemplates={pipelineTemplates}
        onSaveEdit={handleSaveEdit}
        isDeleteOpen={isDeleteOpen}
        setIsDeleteOpen={setIsDeleteOpen}
        onDelete={handleDeleteTask}
      />
    </ToolSelectionContext.Provider>
  );
}
