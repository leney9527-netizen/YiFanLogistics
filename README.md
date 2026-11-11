# 一帆物流 / Yifan Logistics

中国至西非整柜海运报价网站。客户前台、邮箱账号和内部后台在同一个 Next.js 应用里，报价计算、登录和权限都在服务端完成。

公司名称、Logo 和联系方式是占位内容，可在后台修改。仓库里没有真实运价、资质、合作关系或客户评价。

## 本地运行

需要 Node.js 20 或更高版本，以及一个 Supabase 项目。这台开发机没有 Docker，不能在本地启动 Supabase。

```bash
npm ci
copy .env.example .env.local
```

在 Supabase SQL 编辑器中依次执行：

- `supabase/migrations/20261105000000_init.sql`
- `supabase/migrations/20261105000100_numbers.sql`

然后关闭公开注册（Authentication → Sign In / Providers → 禁用 Sign ups），密码最短 15 位。在 Authentication → Hooks 中启用 Custom Access Token hook，函数选择 `public.custom_access_token_hook`。

```bash
npm run create-admin
npm run dev
```

打开 `http://localhost:3000`。首次访问按浏览器语言进入 `/zh`、`/en` 或 `/fr`，无法匹配时使用英文。

## 部署

目标平台是 Vercel。环境变量与 `.env.example` 相同，且只放在服务端。生产环境不要设置 `SHOW_DEMO_RATES=true`。配置每日调用 `POST /api/cron/expire`，请求头 `Authorization: Bearer $CRON_SECRET`。

数据库备份使用 Supabase 的每日备份或时间点恢复。`pg_dump` 不包含 Storage 文件，附件需要单独备份 `inquiry-files` 桶。

## 已实现

- 三语言路由、集中文案和港口等主数据的中英文字段。
- 首页即可查询已发布、未过期的销售价。无结果时是真实空状态，并进入人工询价。
- 服务端按柜量、计费单位和汇率重算，未确认费用不当作 0。
- 登录用户保存报价快照。快照不随后台改价变化。
- 邮箱加密码注册和登录，服务端图形验证码，不验证邮箱所有权，不提供自动找回密码。
- 询价写入数据库并生成编号。后台可改状态。
- 后台维护港口、船公司、运价草稿、汇率、员工和公司信息，并提供 Excel 预览后生成草稿。
- 报价 PDF 使用 Noto Sans SC，覆盖中文、法语重音和货币符号。

## 尚未接入

- 真实运价、港杂费规则和经过业务确认的拖车、报关计费方式。
- 法律条款的正式审核。当前条款是受控占位文案。
- Supabase 原生 CAPTCHA、多因素认证、邮件发送。
- 拼箱、空运、支付和货物跟踪。

## 安全边界

自定义图形验证码由本应用在签发登录许可前校验。Supabase 不会自动执行这套验证码。访问令牌钩子会拒绝没有一次性登录许可的密码登录，但密码校验发生在钩子之前：攻击者如果已经知道密码，错误的许可会返回与密码错误不同的状态，不能据此防止密码猜测。生产环境应同时打开 Supabase 的验证码和频率限制。

邮箱只是账号标识。`email_confirm: true` 只是为了让未验证邮箱也能登录，不代表用户拥有该邮箱。数据按内部用户 ID 归属。

没有“绝对安全”。更完整的说明见 `docs/security.md`。
