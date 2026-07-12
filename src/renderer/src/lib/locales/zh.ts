const zh = {
  // App
  'app.title': '卷轴 Scroll',
  'app.backToLibrary': '书架',
  'app.toc': '目录',
  'app.bookmarks': '书签 & 标注',
  'app.ai': 'AI 助手',
  'app.music': '音乐',
  'app.settings': '设置',
  'app.theme.light': '切换到亮色模式',
  'app.theme.dark': '切换到暗色模式',

  // Library
  'library.empty.title': '你的书架是空的',
  'library.empty.subtitle': '导入电子书，开始阅读之旅',
  'library.empty.importBtn': '导入书籍',
  'library.title': '书架',
  'library.import': '导入',
  'library.unknownAuthor': '未知作者',

  // Reader
  'reader.placeholder.title': '阅读器引擎开发中',
  'reader.placeholder.desc': '当前为阅读器占位组件。已支持的格式：',
  'reader.placeholder.pdf': 'PDF 渲染 — pdf.js',
  'reader.placeholder.epub': 'EPUB 渲染 — JSZip 自研解析器',
  'reader.placeholder.mobi': 'MOBI/AZW3 — 自研 PalmDOC 解析器',
  'reader.placeholder.txt': 'TXT/Markdown 章节分章',
  'reader.placeholder.cbz': 'CBZ/CBR — 漫画浏览引擎',
  'reader.placeholder.djvu': 'DJVU — 待实现',
  'reader.back': '按 Esc 返回书架',

  // AI Panel
  'ai.notConfigured': 'AI 助手未配置',
  'ai.notConfigured.desc': '点击右上角 ⚙ 设置 → AI 服务，配置任意 OpenAI 兼容的 API',
  'ai.notConfigured.providers': '支持的提供商：',
  'ai.notConfigured.list': 'DeepSeek · OpenAI · 通义千问 · Moonshot · 智谱 GLM · 百川 · SiliconFlow ...',
  'ai.welcome': 'AI 助手就绪',
  'ai.welcome.hint': '试试：总结本章内容 · 翻译选中段落 · 解释关键概念',
  'ai.placeholder': '向 AI 提问...',
  'ai.placeholder.disabled': '请先配置 AI 服务',
  'ai.inputHint': 'Enter 发送 · Shift+Enter 换行',

  // Music
  'music.playlist': '播放列表',
  'music.empty': '播放列表为空',
  'music.empty.hint': '添加网络 URL 或导入本地音乐文件',
  'music.noTrack': '未选择曲目',
  'music.addUrl': '+ 添加网络 URL',
  'music.addLocal': '+ 添加本地文件',
  'music.builtin': '内置',
  'music.url': '网络',
  'music.local': '本地',
  'music.live': '实时生成',
  'music.copyright': '内置氛围音由 Web Audio API 实时生成 — 100% 免版权，离线可用。添加 URL 或本地文件时请确保拥有合法使用权。本软件不托管或分发任何音乐文件。',
  'music.prompt.url': '输入音乐 URL（请确保你拥有合法使用权）：',
  'music.prompt.title': '曲目标题：',
  'music.prompt.artist': '艺术家/来源：',
  'music.prompt.untitled': '未命名曲目',
  'music.prompt.unknown': '未知',
  'music.localFile': '本地文件',
  'music.userAdded': '用户自行添加 — 请确保拥有合法使用权',

  // Built-in track names
  'track.whiteNoise': '白噪音',
  'track.brownNoise': '棕色噪音',
  'track.softPad': '柔和背景音',
  'track.rain': '雨声',

  // Settings
  'settings.title': '设置',
  'settings.ai.title': 'AI 服务（可选）',
  'settings.ai.name': '服务名称',
  'settings.ai.namePlaceholder': '例如：我的 DeepSeek',
  'settings.ai.baseUrl': 'API 地址',
  'settings.ai.apiKey': 'API Key',
  'settings.ai.model': '模型名称',
  'settings.ai.maxTokens': 'Max Tokens',
  'settings.ai.showKey': '显示',
  'settings.ai.hideKey': '隐藏',
  'settings.appearance': '外观',
  'settings.appearance.darkMode': '暗色模式',
  'settings.language': '界面语言',
  'settings.language.zh': '中文',
  'settings.language.en': 'English',
  'settings.privacy': '⚠️ API Key 仅存储在你本机的应用数据目录中，不会上传到任何服务器。配置文件不会提交到 Git。',
  'settings.save': '保存配置',
  'settings.saved': '已保存 ✓',
  'settings.cancel': '取消',
  'settings.clear': '清除配置',

  // Common
  'common.ok': '确定',
  'common.cancel': '取消',
  'common.close': '关闭',
  'common.error': '错误',
  'common.loading': '加载中...',

  // Error
  'error.preloadNotLoaded': '应用预加载未完成。\n\n请关闭并重新打开应用。\n如果问题持续，请重新运行 install.bat。'
}

export default zh
export type Translations = typeof zh
