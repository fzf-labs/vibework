import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  projects: {
    getAll: () => ipcRenderer.invoke('projects:getAll'),
    get: (id: string) => ipcRenderer.invoke('projects:get', id),
    add: (project: any) => ipcRenderer.invoke('projects:add', project),
    update: (id: string, updates: any) => ipcRenderer.invoke('projects:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('projects:delete', id)
  },
  git: {
    clone: (remoteUrl: string, targetPath: string) =>
      ipcRenderer.invoke('git:clone', remoteUrl, targetPath),
    init: (path: string) => ipcRenderer.invoke('git:init', path)
  },
  cli: {
    startSession: (sessionId: string, command: string, args: string[], cwd?: string) =>
      ipcRenderer.invoke('cli:startSession', sessionId, command, args, cwd),
    stopSession: (sessionId: string) => ipcRenderer.invoke('cli:stopSession', sessionId),
    getOutput: (sessionId: string) => ipcRenderer.invoke('cli:getOutput', sessionId)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
