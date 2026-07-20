import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'

/**
 * 供应商图标来自 CC Switch 官方资源（勿手绘）：
 * https://github.com/farion1231/cc-switch/tree/main/src/icons/extracted
 */
import deepseekIcon from '../assets/ai-providers/deepseek.svg'
import kimiIcon from '../assets/ai-providers/kimi.svg'
import openaiIcon from '../assets/ai-providers/openai.svg'
import qwenIcon from '../assets/ai-providers/qwen.svg'
import zhipuIcon from '../assets/ai-providers/zhipu.svg'
import siliconflowIcon from '../assets/ai-providers/siliconflow.svg'

/** 与设置页预设对应；Kimi 与 Moonshot 同属一家 */
export type KnownAiProvider =
  | 'deepseek'
  | 'kimi'
  | 'openai'
  | 'qwen'
  | 'zhipu'
  | 'siliconflow'

const PROVIDER_ICONS: Record<KnownAiProvider, string> = {
  deepseek: deepseekIcon,
  kimi: kimiIcon,
  openai: openaiIcon,
  qwen: qwenIcon,
  zhipu: zhipuIcon,
  siliconflow: siliconflowIcon
}

export function detectAiProvider(config: {
  name?: string
  baseUrl?: string
  model?: string
}): KnownAiProvider | null {
  const hay = [config.name, config.baseUrl, config.model]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (!hay.trim()) return null

  if (/deepseek/.test(hay)) return 'deepseek'
  if (/moonshot|kimi/.test(hay)) return 'kimi'
  if (/openai\.com|\bopenai\b|(^|[^a-z])gpt-/.test(hay)) return 'openai'
  if (/dashscope|aliyuncs|\bqwen\b|tongyi/.test(hay)) return 'qwen'
  if (/bigmodel|zhipu|\bglm[-.]|chatglm/.test(hay)) return 'zhipu'
  if (/siliconflow/.test(hay)) return 'siliconflow'

  return null
}

function IconShell({
  children,
  className
}: {
  children: ReactNode
  className: string
}) {
  return (
    <div
      className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * AI 面板空态中央图标：
 * - 未配置：默认 Sparkles + 灰底
 * - 已配置且可识别供应商：CC Switch 官方 SVG
 * - 已配置但未知：默认 Sparkles（主题色）
 */
export function AiWelcomeIcon({
  configured,
  provider
}: {
  configured: boolean
  provider: KnownAiProvider | null
}) {
  if (!configured) {
    return (
      <IconShell className="bg-gray-200 dark:bg-gray-700">
        <Sparkles size={26} className="text-gray-400 dark:text-gray-500" />
      </IconShell>
    )
  }

  if (provider) {
    return (
      <IconShell className="bg-gray-100 dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700">
        <img
          src={PROVIDER_ICONS[provider]}
          alt=""
          draggable={false}
          className="h-8 w-8 object-contain"
        />
      </IconShell>
    )
  }

  return (
    <IconShell className="bg-scroll-100 dark:bg-scroll-900/40">
      <Sparkles size={26} className="text-scroll-500" />
    </IconShell>
  )
}
