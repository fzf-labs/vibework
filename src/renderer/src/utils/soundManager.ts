/**
 * 声音管理器
 * 负责播放各种通知声音
 */

type SoundType = 'success' | 'info' | 'error' | 'complete'

class SoundManager {
  private audioContext: AudioContext | null = null
  private sounds: Map<SoundType, AudioBuffer> = new Map()

  constructor() {
    this.initAudioContext()
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error)
    }
  }

  /**
   * 播放声音
   */
  async play(type: SoundType): Promise<void> {
    if (!this.audioContext) {
      return
    }

    try {
      // 使用 Web Audio API 生成简单的提示音
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      // 根据类型设置不同的音调
      const frequencies = this.getFrequencies(type)

      oscillator.frequency.setValueAtTime(frequencies[0], this.audioContext.currentTime)

      if (frequencies.length > 1) {
        oscillator.frequency.setValueAtTime(
          frequencies[1],
          this.audioContext.currentTime + 0.1
        )
      }

      // 设置音量渐变
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + 0.3
      )

      oscillator.start(this.audioContext.currentTime)
      oscillator.stop(this.audioContext.currentTime + 0.3)
    } catch (error) {
      console.error('Failed to play sound:', error)
    }
  }

  /**
   * 根据声音类型获取频率
   */
  private getFrequencies(type: SoundType): number[] {
    switch (type) {
      case 'success':
        return [523.25, 659.25] // C5 -> E5 (成功音)
      case 'complete':
        return [659.25, 783.99] // E5 -> G5 (完成音)
      case 'error':
        return [329.63, 293.66] // E4 -> D4 (错误音)
      case 'info':
      default:
        return [440] // A4 (信息音)
    }
  }
}

// 导出单例
export const soundManager = new SoundManager()
