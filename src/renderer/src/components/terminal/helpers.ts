import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { CanvasAddon } from '@xterm/addon-canvas'
import { WebLinksAddon } from '@xterm/addon-web-links'

export interface TerminalInstance {
  xterm: Terminal
  fitAddon: FitAddon
  cleanup: () => void
}

function loadRenderer(xterm: Terminal): { dispose: () => void } {
  let renderer: WebglAddon | CanvasAddon | null = null

  try {
    const webglAddon = new WebglAddon()
    webglAddon.onContextLoss(() => {
      webglAddon.dispose()
      try {
        renderer = new CanvasAddon()
        xterm.loadAddon(renderer)
      } catch {
        renderer = null
      }
    })
    xterm.loadAddon(webglAddon)
    renderer = webglAddon
  } catch {
    try {
      renderer = new CanvasAddon()
      xterm.loadAddon(renderer)
    } catch {
      renderer = null
    }
  }

  return {
    dispose: () => renderer?.dispose()
  }
}

export function createTerminalInstance(
  container: HTMLDivElement,
  options?: { onUrlClick?: (url: string) => void }
): TerminalInstance {
  const xterm = new Terminal({
    fontFamily: 'Menlo, Monaco, "SF Mono", "Liberation Mono", monospace',
    fontSize: 12,
    lineHeight: 1.3,
    cursorBlink: true,
    theme: {
      background: '#0b0b0d',
      foreground: '#f5f5f5'
    }
  })

  xterm.open(container)

  const fitAddon = new FitAddon()
  xterm.loadAddon(fitAddon)

  const renderer = loadRenderer(xterm)

  if (options?.onUrlClick) {
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      if (event.metaKey || event.ctrlKey) {
        options.onUrlClick?.(uri)
      }
    })
    xterm.loadAddon(webLinksAddon)
  }

  try {
    fitAddon.fit()
  } catch {
    // ignore fit errors
  }

  return {
    xterm,
    fitAddon,
    cleanup: () => {
      renderer.dispose()
    }
  }
}
