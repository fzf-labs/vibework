import { useCallback, useEffect, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import { db, type Task } from '@/data';

import type { PipelineTemplate } from '../types';

interface UseTaskDetailDialogsInput {
  task: Task | null;
  taskId?: string;
  navigate: NavigateFunction;
  setTask: React.Dispatch<React.SetStateAction<Task | null>>;
}

export function useTaskDetailDialogs({
  task,
  taskId,
  navigate,
  setTask,
}: UseTaskDetailDialogsInput) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [editCliToolId, setEditCliToolId] = useState('');
  const [editPipelineTemplateId, setEditPipelineTemplateId] = useState('');
  const [pipelineTemplates, setPipelineTemplates] = useState<PipelineTemplate[]>([]);

  const handleOpenEdit = useCallback(() => {
    if (!task || task.status !== 'todo') return;
    setEditPrompt(task.prompt || '');
    setEditCliToolId(task.cli_tool_id || '');
    setEditPipelineTemplateId(task.pipeline_template_id || '');
    setIsEditOpen(true);
  }, [task]);

  const handleSaveEdit = useCallback(async () => {
    if (!taskId) return;
    const trimmedPrompt = editPrompt.trim();
    if (!trimmedPrompt) return;

    try {
      const updatedTask = await db.updateTask(taskId, {
        prompt: trimmedPrompt,
        cli_tool_id: editCliToolId || null,
        pipeline_template_id: editPipelineTemplateId || null,
      });
      if (updatedTask) {
        setTask(updatedTask);
      }
      setIsEditOpen(false);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  }, [editCliToolId, editPipelineTemplateId, editPrompt, setTask, taskId]);

  const handleDeleteTask = useCallback(async () => {
    if (!taskId) return;
    try {
      await db.deleteTask(taskId);
      setIsDeleteOpen(false);
      navigate('/');
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  }, [navigate, taskId]);

  useEffect(() => {
    if (!isEditOpen) return;
    let active = true;

    const loadTemplates = async () => {
      if (!task?.project_id) {
        setPipelineTemplates([]);
        return;
      }
      try {
        const templates = await db.getWorkflowTemplatesByProject(task.project_id);
        if (active) {
          setPipelineTemplates(templates as PipelineTemplate[]);
        }
      } catch (error) {
        console.error('Failed to load pipeline templates:', error);
        if (active) {
          setPipelineTemplates([]);
        }
      }
    };

    void loadTemplates();
    return () => {
      active = false;
    };
  }, [isEditOpen, task?.project_id]);

  return {
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
  };
}
