const PROVIDER = "sensenova"
const BASE = "https://api.sensenova.cn/compatible-mode/v2"
const VERSION = "0.1.0"

// 官方兼容模式模型清单与价格:https://www.sensecore.cn/help/docs/model-as-a-service/nova/overview/compatible-mode
// cost 为美元/百万 tokens,按 1 CNY = 0.14 USD 从人民币单价换算,仅供估算。
const MODELS = {
  "SenseChat-5": {
    name: "SenseChat 5",
    description: "通用大模型(V5),128K 上下文,语言、知识、推理、数学、代码能力显著提升",
    limit: { context: 128000, output: 16384 },
    tool_call: true,
    cost: { input: 1.12, output: 2.8 },
  },
  "SenseChat": {
    name: "SenseChat (V4)",
    description: "基础版本模型(V4),4K 上下文,通用能力强大",
    limit: { context: 4096, output: 4096 },
    tool_call: true,
    cost: { input: 1.68, output: 1.68 },
  },
  "SenseChat-Turbo": {
    name: "SenseChat Turbo",
    description: "轻量模型,适用于快速问答场景",
    limit: { context: 32768, output: 8192 },
    tool_call: true,
    cost: { input: 0.042, output: 0.084 },
  },
  "SenseChat-5-Cantonese": {
    name: "SenseChat 5 Cantonese",
    description: "32K 上下文,粤语对话理解",
    limit: { context: 32768, output: 8192 },
    tool_call: true,
    cost: { input: 3.78, output: 3.78 },
  },
  "SenseNova-V6.5-Pro": {
    name: "SenseNova V6.5 Pro",
    description: "多模态旗舰模型,128K 上下文,图片、文本、视频原生统一",
    limit: { context: 128000, output: 16384 },
    tool_call: true,
    modalities: { input: ["text", "image"] },
    cost: { input: 0.42, output: 1.26 },
  },
  "SenseNova-V6.5-Turbo": {
    name: "SenseNova V6.5 Turbo",
    description: "多模态高效模型,128K 上下文,图片、文本、视频原生统一",
    limit: { context: 128000, output: 16384 },
    tool_call: true,
    modalities: { input: ["text", "image"] },
    cost: { input: 0.21, output: 0.63 },
  },
  "SenseChat-Vision": {
    name: "SenseChat Vision",
    description: "多模态模型,4K 上下文,图文感知",
    limit: { context: 4096, output: 4096 },
    tool_call: true,
    modalities: { input: ["text", "image"] },
    cost: { input: 1.4, output: 8.4 },
  },
}

// /models 返回的未知模型里,只有对话家族(SenseChat*/SenseNova*)才当作聊天模型,
// 过滤掉 SenseEmbed 之类的非对话模型;未知机型用保守的上下文/输出上限。
function entryFor(id) {
  const known = MODELS[id]
  if (known) return { ...known }
  if (/^(sensechat|sensenova)-/i.test(id)) {
    return { name: id, limit: { context: 32768, output: 8192 }, tool_call: true }
  }
  return undefined
}

export const SenseNovaAuthPlugin = async () => ({
  // 供应商与默认模型;??= 保证不覆盖用户自己的配置
  config: async (cfg) => {
    cfg.provider ??= {}
    cfg.provider[PROVIDER] ??= {
      name: "SenseNova",
      npm: "@ai-sdk/openai-compatible",
      api: BASE,
      models: MODELS,
    }
  },

  auth: {
    provider: PROVIDER,
    methods: [
      {
        type: "api",
        label: "SenseNova API key",
        placeholder: "在 platform.sensenova.cn 控制台「API-Key 管理」创建",
      },
    ],
    // 这个账号的每个请求带上 Bearer key
    async loader(getAuth) {
      const auth = await getAuth()
      if (auth?.type !== "api") return {}
      return {
        baseURL: BASE,
        headers: { "x-client": `opencode-sensenova-auth/${VERSION}` },
        async fetch(input, init) {
          const headers = new Headers(init?.headers)
          headers.set("authorization", `Bearer ${auth.key}`)
          return fetch(input, { ...init, headers })
        },
      }
    },
  },

  // 向 SenseNova 查询这个账号实际可用的模型,与已知清单合并;失败时保留原列表
  provider: {
    id: PROVIDER,
    async models(provider, { auth } = {}) {
      if (auth?.type !== "api") return provider.models
      let res
      try {
        res = await fetch(`${BASE}/models`, { headers: { authorization: `Bearer ${auth.key}` } })
      } catch {
        return provider.models
      }
      if (!res.ok) return provider.models
      let data
      try {
        ;({ data } = await res.json())
      } catch {
        return provider.models
      }
      const merged = {}
      for (const m of data ?? []) {
        const entry = entryFor(m.id)
        if (entry) merged[m.id] = entry
      }
      return Object.keys(merged).length > 0 ? merged : provider.models
    },
  },
})
