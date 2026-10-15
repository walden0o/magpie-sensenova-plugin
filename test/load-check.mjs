// 无网络的加载冒烟测试:node test/load-check.mjs
import assert from "node:assert/strict"
import { SenseNovaAuthPlugin } from "../index.mjs"

const realFetch = globalThis.fetch
const hooks = await SenseNovaAuthPlugin({})
assert.equal(typeof hooks.config, "function")
assert.equal(hooks.auth.provider, "sensenova")
assert.equal(typeof hooks.auth.loader, "function")
assert.equal(hooks.provider.id, "sensenova")
console.log("PASS plugin shape")

// 1. config 钩子声明供应商与默认模型
const cfg = {}
await hooks.config(cfg)
const p = cfg.provider.sensenova
assert.equal(p.name, "SenseNova")
assert.equal(p.npm, "@ai-sdk/openai-compatible")
assert.equal(p.api, "https://token.sensenova.cn/v1")
assert.equal(Object.keys(p.models).length, 1)
assert.ok(p.models["sensenova-6.8-flash-lite"])
console.log("PASS config hook")

// 2. config 不覆盖用户已有配置
const cfg2 = { provider: { sensenova: { name: "mine" } } }
await hooks.config(cfg2)
assert.equal(cfg2.provider.sensenova.name, "mine")
console.log("PASS config keeps user config")

// 3. models 钩子:未登录时回退原列表
const fallback = await hooks.provider.models({ models: p.models }, {})
assert.deepEqual(Object.keys(fallback), ["sensenova-6.8-flash-lite"])
console.log("PASS models fallback without auth")

// 4. models 钩子:请求失败(401)时回退原列表且不抛错
globalThis.fetch = async () => ({ ok: false, status: 401 })
const fb401 = await hooks.provider.models({ models: p.models }, { auth: { type: "api", key: "k" } })
assert.deepEqual(Object.keys(fb401), ["sensenova-6.8-flash-lite"])
console.log("PASS models fallback on 401")

// 5. models 钩子:合并远端列表,过滤非对话模型,远程 metadata 覆盖占位上限
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({
    data: [
      { id: "sensenova-6.8-flash-lite", name: "SenseNova 6.8 Flash Lite", context_length: 131072, max_output_tokens: 32768 },
      { id: "SenseEmbed-xxx" },
      { id: "sensenova-u1-fast", context_length: 65536, input_modalities: ["text", "image"] },
    ],
  }),
})
const merged = await hooks.provider.models({ models: p.models }, { auth: { type: "api", key: "k" } })
assert.deepEqual(Object.keys(merged), ["sensenova-6.8-flash-lite", "sensenova-u1-fast"])
assert.equal(merged["sensenova-6.8-flash-lite"].limit.context, 131072)
assert.equal(merged["sensenova-6.8-flash-lite"].limit.output, 32768)
assert.equal(merged["sensenova-u1-fast"].limit.context, 65536)
assert.deepEqual(merged["sensenova-u1-fast"].modalities.input, ["text", "image"])
console.log("PASS models merge")

// 6. loader:API key 账号注入 Bearer 头,并保留/覆盖传入头
let captured
globalThis.fetch = async (input, init) => {
  captured = { input, init }
  return { ok: true, status: 200 }
}
const loader = await hooks.auth.loader(async () => ({ type: "api", key: "test-key" }))
assert.equal(loader.baseURL, "https://token.sensenova.cn/v1")
await loader.fetch("https://token.sensenova.cn/v1/chat/completions", {
  method: "POST",
  headers: { "content-type": "application/json" },
})
assert.equal(captured.init.headers.get("authorization"), "Bearer test-key")
assert.equal(captured.init.headers.get("content-type"), "application/json")
console.log("PASS loader fetch headers")

// 7. loader:非 api 登录返回空对象
const empty = await hooks.auth.loader(async () => undefined)
assert.deepEqual(empty, {})
console.log("PASS loader without auth")

globalThis.fetch = realFetch
console.log("ALL PASS")
