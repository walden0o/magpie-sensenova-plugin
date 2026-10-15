# opencode-sensenova-auth

Magpie / OpenCode 供应商插件:用 SenseNova(商汤日日新)Token Plan 的 API Key 登录,把日日新大模型作为 `sensenova` 供应商提供给所有 agent,支持多账号与故障切换。

## 登录

1. 在 [SenseNova 控制台](https://platform.sensenova.cn/console/keys)(API-Key 管理)创建 API Key,创建后立即复制;
2. 添加并登录本插件:

```bash
magpie plugin add walden0o/magpie-sensenova-plugin
magpie plugin login sensenova
magpie provider test sensenova
```

登录信息保存在 magpie 配置目录的 `plugin-auth.json`(权限 600),不会上传。

## 接入方式

- SenseNova Token Plan:`https://token.sensenova.cn/v1`(OpenAI Chat Completions 兼容)
- 鉴权:`Authorization: Bearer <API Key>`
- Token Plan 免费公测:每模型每 5 小时 1500 次调用(以官方页面为准)

## 模型

| 模型 | 说明 |
| --- | --- |
| sensenova-6.8-flash-lite | 轻量多模态智能体预览版:自主规划、长程执行、多 Agent 协作 |

登录后插件会请求 `GET /models` 获取账号实际可用的模型;Token Plan 上新的机型(如 SenseNova U1 Fast、后续 6.8 正式版)会自动加入,并采用远端返回的上下文/输出上限。

## 说明

- 6.8 flash lite 精确的上下文/输出上限官方未公布,内置按同家族规格(256K/65536)占位,登录后以 `/models` 返回值为准;
- SenseNova 未提供公开的额度/余额接口,因此本插件没有 usage 钩子。

## License

MIT
