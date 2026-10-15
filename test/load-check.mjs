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

// 1. config 钩子声明供应商与 7 个默认模型
const cfg = {}
await hooks.config(cfg)
const p = cfg.provider.sensenova
assert.equal(p.name, "SenseNova")
assert.equal(p.npm, "@ai-sdk/openai-compatible")
assert.equal(p.api, "https://api.sensenova.cn/compatible-mode/v2")
assert.equal(Object.keys(p.models).length, 7)
console.log("PASS config hook")

// 2. config 不覆盖用户已有配置
const cfg2 = { provider: { sensenova: { name: "mine" } } }
await hooks.config(cfg2)
assert.equal(cfg2.provider.sensenova.name, "mine")
console.log("PASS config keeps user config")

// 3. models 钩子:未登录时回退原列表
const fallback = await hooks.provider.models({ models: p.models }, {})
assert.deepEqual(Object.keys(fallback).sort(), Object.keys(p.models).sort())
console.log("PASS models fallback without auth")

// 4. models 钩子:/models 请求失败(401)时回退原列表且不抛错
globalThis.fetch = async () => ({ ok: false, status: 401 })
const fb401 = await hooks.provider.models({ models: p.models }, { auth: { type: "api", key: "k" } })
assert.deepEqual(Object.keys(fb401).sort(), Object.keys(p.models).sort())
console.log("PASS models fallback on 401")

// 5. models 钩子:合并远端列表,过滤非对话模型,未知 SenseNova* 机型以保守参数加入
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({ data: [{ id: "SenseChat-5" }, { id: "SenseEmbed-xxx" }, { id: "SenseNova-V7-Pro" }] }),
})
const merged = await hooks.provider.models({ models: p.models }, { auth: { type: "api", key: "k" } })
assert.deepEqual(Object.keys(merged), ["SenseChat-5", "SenseNova-V7-Pro"])
assert.equal(merged["SenseChat-5"].limit.context, 128000)
assert.equal(merged["SenseNova-V7-Pro"].limit.context, 32768)
console.log("PASS models merge")

// 6. loader:API key 账号注入 Bearer 头,并保留/覆盖传入头
let captured
globalThis.fetch = async (input, init) => {
  captured = { input, init }
  return { ok: true, status: 200 }
}
const loader = await hooks.auth.loader(async () => ({ type: "api", key: "test-key" }))
assert.equal(loader.baseURL, "https://api.sensenova.cn/compatible-mode/v2")
await loader.fetch("https://api.sensenova.cn/compatible-mode/v2/chat/completions", {
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
