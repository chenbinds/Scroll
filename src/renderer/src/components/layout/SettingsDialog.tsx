import { useState } from 'react'
import { X, Eye, EyeOff, Save, Trash2, Globe, Key, Cpu, Sparkles, Wifi } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useI18n, type Language } from '../../lib/i18n'
import { testConnection } from '../../lib/aiService'
import ThemeSelect from '../reader/ThemeSelect'

interface Props {
  onClose: () => void
}

const AI_PRESETS: Record<string, { name: string; baseUrl: string; model: string }> = {
  deepseek: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  qwen: { name: 'Qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  moonshot: { name: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  zhipu: { name: 'GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  siliconflow: { name: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' }
}

export default function SettingsDialog({ onClose }: Props) {
  const { t, language, setLanguage } = useI18n()
  const { aiConfig, setAiConfig } = useAppStore()
  const [showKey, setShowKey] = useState(false)
  const [name, setName] = useState(aiConfig.name)
  const [baseUrl, setBaseUrl] = useState(aiConfig.baseUrl)
  const [apiKey, setApiKey] = useState(aiConfig.apiKey)
  const [model, setModel] = useState(aiConfig.model)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const handlePreset = (key: string) => {
    const preset = AI_PRESETS[key]
    if (preset) { setName(preset.name); setBaseUrl(preset.baseUrl); setModel(preset.model) }
  }

  const handleSave = () => {
    setAiConfig({ name, baseUrl, apiKey, model, maxTokens: 4096 })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClear = () => {
    setName(''); setBaseUrl(''); setApiKey(''); setModel('')
    setAiConfig({ name: '', baseUrl: '', apiKey: '', model: '', maxTokens: 4096 })
    setTestResult(null)
  }

  const handleTest = async () => {
    if (!baseUrl || !apiKey || !model) {
      setTestResult(t('settings.ai.testMissing'))
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      await testConnection({ baseUrl, apiKey, model })
      setTestResult(t('settings.ai.testOk'))
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : t('settings.ai.testFailed'))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[560px] max-h-[80vh] overflow-y-auto
                      border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('settings.title')}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* ===== AI Config ===== */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-scroll-500" />
              {t('settings.ai.title')}
            </h3>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {Object.entries(AI_PRESETS).map(([key, preset]) => (
                <button key={key} onClick={() => handlePreset(key)}
                  className="text-xs px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700
                             hover:bg-scroll-50 dark:hover:bg-scroll-900/20 hover:border-scroll-300
                             text-gray-600 dark:text-gray-400 transition-colors">
                  {preset.name}
                </button>
              ))}
            </div>

            <div className="space-y-1.5 mb-3">
              <label className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Globe size={12} /> {t('settings.ai.name')}
              </label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder={t('settings.ai.namePlaceholder')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700
                           bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-scroll-500/50" />
            </div>

            <div className="space-y-1.5 mb-3">
              <label className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Globe size={12} /> {t('settings.ai.baseUrl')}
              </label>
              <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.deepseek.com/v1"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700
                           bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-scroll-500/50" />
            </div>

            <div className="space-y-1.5 mb-3">
              <label className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Key size={12} /> {t('settings.ai.apiKey')}
              </label>
              <div className="relative">
                <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700
                             bg-white dark:bg-gray-800 px-3 py-2 pr-10 text-sm font-mono text-gray-900 dark:text-gray-100
                             focus:outline-none focus:ring-2 focus:ring-scroll-500/50" />
                <button onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title={showKey ? t('settings.ai.hideKey') : t('settings.ai.showKey')}>
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Cpu size={12} /> {t('settings.ai.model')}
              </label>
              <input type="text" value={model} onChange={(e) => setModel(e.target.value)}
                placeholder="deepseek-chat"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700
                           bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-scroll-500/50" />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => { void handleTest() }}
                disabled={testing}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700
                           hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                <Wifi size={12} className={testing ? 'animate-pulse' : ''} />
                {testing ? t('settings.ai.testing') : t('settings.ai.testConnection')}
              </button>
              {testResult && (
                <span className={`text-xs ${testResult === t('settings.ai.testOk') ? 'text-green-600' : 'text-red-500'}`}>
                  {testResult}
                </span>
              )}
            </div>
          </section>

          {/* ===== Language ===== */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('settings.language')}</h3>
            <div className="flex gap-2">
              {(['zh', 'en'] as Language[]).map((lang) => (
                <button key={lang} onClick={() => setLanguage(lang)}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    language === lang
                      ? 'bg-scroll-500 text-white border-scroll-500'
                      : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  {lang === 'zh' ? t('settings.language.zh') : t('settings.language.en')}
                </button>
              ))}
            </div>
          </section>

          {/* ===== Appearance ===== */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('settings.appearance')}</h3>
            <ThemeSelect variant="settings" />
          </section>

          {/* ===== Privacy ===== */}
          <section className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">{t('settings.privacy')}</p>
          </section>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-800">
          <button onClick={handleClear}
            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition-colors">
            <Trash2 size={14} />{t('settings.clear')}
          </button>
          <div className="flex gap-2 items-center">
            {saved && <span className="text-xs text-green-600 dark:text-green-400 font-medium">{t('settings.saved')}</span>}
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400
                         hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              {t('settings.cancel')}
            </button>
            <button onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-scroll-500 hover:bg-scroll-600
                         text-white rounded-lg transition-colors">
              <Save size={14} />{t('settings.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
