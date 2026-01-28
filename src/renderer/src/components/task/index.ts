export { VirtualComputer } from './VirtualComputer';
export { ToolExecutionItem } from './ToolExecutionItem';
export { RightSidebar, type Artifact } from './RightSidebar';
export { PlanApproval } from './PlanApproval';
export { QuestionInput } from './QuestionInput';
export { TaskList } from './TaskList';
export { CreateTaskDialog } from './CreateTaskDialog';
export { TaskMetadataPanel } from './TaskMetadataPanel';

// Components moved from pages/task-detail
export { ToolSelectionContext, useToolSelection } from './context';
export { UserMessage } from './UserMessage';
export { MessageItem } from './MessageItem';
export { MessageList } from './MessageList';
export { ErrorMessage } from './ErrorMessage';
export { RunningIndicator } from './RunningIndicator';
export { TaskGroupComponent } from './TaskGroupComponent';

// Utils
export { convertFileType, getArtifactTypeFromExt } from './utils';

// Re-export ArtifactPreview from its new location for backwards compatibility
export { ArtifactPreview } from '@/components/artifacts';
