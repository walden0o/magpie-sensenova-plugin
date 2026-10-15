# opencode-sensenova-auth

Magpie / OpenCode 供应商插件:用 SenseNova(商汤日日新)的 API Key 登录,把日日新大模型作为 `sensenova` 供应商提供给所有 agent,支持多账号与故障切换。

## 登录

1. 在 [SenseNova 控制台](https://platform.sensenova.cn/console/keys)(管理中心 → API-Key 管理)创建 API Key,创建后立即复制;
2. 添加并登录本插件:

```bash
magpie plugin add ./magpie-sensenova-plugin
magpie plugin login sensenova
magpie provider test sensenova
```

登录信息保存在 magpie 配置目录的 `plugin-auth.json`(权限 600),不会上传。

## 接入方式

- OpenAI 兼容模式 v2:`https://api.sensenova.cn/compatible-mode/v2`
- 鉴权:`Authorization: Bearer <API Key>`
- 请求/响应格式与 OpenAI Chat Completions 一致,流式回复带 usage 统计

## 模型

| 模型 | 类型 | 上下文 | 输入 |
| --- | --- | --- | --- |
| SenseChat-5 | 通用 | 128K | 文本 |
| SenseChat (V4) | 通用 | 4K | 文本 |
| SenseChat-Turbo | 轻量 | 32K | 文本 |
| SenseChat-5-Cantonese | 粤语 | 32K | 文本 |
| SenseNova-V6.5-Pro | 多模态旗舰 | 128K | 文本+图片 |
| SenseNova-V6.5-Turbo | 多模态高效 | 128K | 文本+图片 |
| SenseChat-Vision | 多模态 | 4K | 文本+图片 |

登录后插件会请求 `GET /models` 获取账号实际可用的模型,与上表合并;新机型(如 SenseNova-V7)自动以保守参数加入。

## 说明

- `cost` 由官方人民币单价按 1 CNY ≈ 0.14 USD 换算为美元/百万 tokens,仅供估算;
- 官方未公布各模型输出上限,插件取保守值(128K 机型 16384、32K 机型 8192、4K 机型 4096);
- SenseNova 未提供公开的额度/余额接口,因此本插件没有 usage 钩子。

## License

MIT
