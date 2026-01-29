export { VirtualComputer } from './VirtualComputer';
export { ToolExecutionItem } from './ToolExecutionItem';
export { PlanApproval } from './PlanApproval';
export { QuestionInput } from './QuestionInput';
export { TaskList } from './TaskList';
export { CreateTaskDialog } from './CreateTaskDialog';
export { TaskMetadataPanel } from './TaskMetadataPanel';
export { RightPanel } from './RightPanel';

// Components moved from pages/task-detail
export { ToolSelectionContext, useToolSelection } from './context';
export { UserMessage } from './UserMessage';
export { MessageItem } from './MessageItem';
export { MessageList } from './MessageList';
export { ErrorMessage } from './ErrorMessage';
export { RunningIndicator } from './RunningIndicator';
export { TaskGroupComponent } from './TaskGroupComponent';

// Utils
export { getArtifactTypeFromExt } from './utils';

// Re-export ArtifactPreview from its new location for backwards compatibility
export { ArtifactPreview } from '@/components/artifacts';
