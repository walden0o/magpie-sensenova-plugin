const PROVIDER = "sensenova"
const BASE = "https://token.sensenova.cn/v1"
const VERSION = "0.2.0"

// SenseNova Token Plan:https://github.com/OpenSenseNova/SenseNova6.8
// 免费公测:每模型每 5 小时 1500 次调用。精确上下文/输出上限官方未公布,
// 内置值按 6.7 同家族规格占位,登录后以 GET /models 返回的 context_length / max_output_tokens 为准。
const MODELS = {
  "sensenova-6.8-flash-lite": {
    name: "SenseNova 6.8 Flash Lite (Preview)",
    description: "轻量多模态智能体预览版:自主规划、长程执行、多 Agent 协作、端到端交付",
    limit: { context: 256000, output: 65536 },
    reasoning: true,
    tool_call: true,
    modalities: { input: ["text", "image"] },
  },
}

// /models 返回的未知模型里,只有 SenseNova*/SenseChat* 家族才当作聊天模型;
// 远端给出的 context_length / max_output_tokens / input_modalities 优先于内置占位值。
function entryFor(id, remote = {}) {
  const known = MODELS[id]
  const entry = known ? { ...known } : /^(sensenova|sensechat)-/i.test(id)
    ? { name: id, limit: { context: 32768, output: 8192 }, tool_call: true }
    : undefined
  if (!entry) return undefined
  const ctx = remote.context_length ?? remote.max_context_length
  const out = remote.max_output_tokens ?? remote.max_completion_tokens
  if (typeof ctx === "number" || typeof out === "number") {
    entry.limit = {
      context: typeof ctx === "number" ? ctx : entry.limit.context,
      output: typeof out === "number" ? out : entry.limit.output,
    }
  }
  const inputs = remote.input_modalities ?? remote.inputModalities
  if (Array.isArray(inputs) && inputs.includes("image")) {
    entry.modalities = { input: ["text", "image"] }
  }
  if (!entry.name || entry.name === id) entry.name = remote.name ?? id
  return entry
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
        placeholder: "在 platform.sensenova.cn 控制台「API-Key 管理」创建(Token Plan)",
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

  // 向 SenseNova 查询这个账号实际可用的模型;失败时保留原列表
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
        const entry = entryFor(m.id ?? m, m)
        if (entry) merged[m.id ?? m] = entry
      }
      return Object.keys(merged).length > 0 ? merged : provider.models
    },
  },
})
