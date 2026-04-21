# TikTok WebView 信贷 H5 安全防御清单

> 除"限制本人在 TikTok 中访问"外，信贷产品 H5 页面还需关注以下安全问题。

---

## 一、传输层安全

### 1.1 HTTPS 强制

```nginx
server {
    listen 80;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    ssl_protocols TLSv1.2 TLSv1.3;  # 禁用旧版本
    ssl_ciphers HIGH:!aNULL:!MD5;

    # HSTS：强制浏览器使用 HTTPS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
```

### 1.2 证书固定（Certificate Pinning）

防中间人攻击（用户连了恶意 Wi-Fi 等场景）。需与 TikTok 侧协商在 WebView 配置中启用证书固定，或在前端做公钥校验。

---

## 二、前端安全

### 2.1 XSS 防御

信贷页面涉及姓名、身份证、银行卡等敏感输入，XSS 一旦成功后果极其严重。

**① 响应头防护：**

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.example.com;" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

**② 前端输入过滤：**

```javascript
// 所有用户输入必须做转义，禁止直接 innerHTML
function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

// 姓名输入：只允许中文、英文、·
function sanitizeName(name) {
  return name.replace(/[^\u4e00-\u9fa5a-zA-Z·]/g, '')
}

// 身份证号：只允许数字和X
function sanitizeIdCard(id) {
  return id.replace(/[^0-9Xx]/g, '').slice(0, 18)
}
```

### 2.2 Clickjacking（点击劫持）防御

防止恶意页面通过 iframe 嵌套信贷页面，诱导用户点击。

```nginx
# 禁止被任何页面以 iframe 嵌入
add_header X-Frame-Options "DENY" always;

# 或只允许 TikTok 域名嵌入
add_header Content-Security-Policy "frame-ancestors 'self' https://*.tiktok.com;" always;
```

### 2.3 敏感数据前端处理

```javascript
// ❌ 错误：明文存储在 localStorage
localStorage.setItem('idCard', '110101199001011234')

// ✅ 正确：敏感数据不在前端持久化，仅内存中短暂持有
let tempIdCard = null

function onSubmit() {
  api.post('/apply', { idCard: tempIdCard })
  tempIdCard = null // 提交后立即清除
}

// ✅ 正确：表单自动填充关闭
// <input type="text" autocomplete="off" />

// ✅ 正确：禁止页面缓存（防回退查看）
// <meta http-equiv="Cache-Control" content="no-store" />
// <meta http-equiv="Pragma" content="no-cache" />
```

### 2.4 防截屏/录屏提示

H5 无法真正阻止截屏，但可以做到：

```javascript
// 监听页面可见性变化（用户切出去可能是截屏/录屏）
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // 隐藏敏感信息
    document.querySelectorAll('.sensitive').forEach((el) => {
      el.style.visibility = 'hidden'
    })
  } else {
    document.querySelectorAll('.sensitive').forEach((el) => {
      el.style.visibility = 'visible'
    })
  }
})

// 敏感信息展示时加水印（事后追溯）
function addWatermark(userId) {
  const canvas = document.createElement('canvas')
  // ... 生成包含 userId + 时间戳的半透明水印
  document.body.style.backgroundImage = `url(${canvas.toDataURL()})`
}
```

### 2.5 防调试/防篡改

```javascript
// 禁用右键 + F12（基础防护，可被绕过）
document.addEventListener('contextmenu', (e) => e.preventDefault())
document.addEventListener('keydown', (e) => {
  if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
    e.preventDefault()
  }
})

// 检测开发者工具（通过 debugger 断点检测）
setInterval(() => {
  const start = performance.now()
  debugger
  if (performance.now() - start > 100) {
    // 开发者工具被打开，清除页面
    document.body.innerHTML = ''
    window.location.href = 'about:blank'
  }
}, 1000)
```

> ⚠️ 前端防调试只能增加攻击门槛，不能依赖它做安全保障。核心安全必须在后端。

---

## 三、API / 接口安全

### 3.1 接口签名防篡改

防止请求参数被中间人或抓包工具篡改（比如把贷款金额从1万改成100万）。

```javascript
// === 前端：请求签名 ===
function signRequest(params, timestamp) {
  // 参数按 key 排序拼接
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  const raw = `${sorted}&timestamp=${timestamp}&key=${API_SIGN_KEY}`
  return CryptoJS.SHA256(raw).toString()
}

// 请求示例
const params = { amount: 10000, term: 12, productId: 'loan_001' }
const timestamp = Date.now()
api.post('/loan/apply', {
  ...params,
  timestamp,
  sign: signRequest(params, timestamp),
})
```

```javascript
// === 后端：验签中间件 ===
function verifySign(req, res, next) {
  const { sign, timestamp, ...params } = req.body

  // 时效检查：请求必须在5分钟内
  if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
    return res.status(403).json({ message: '请求已过期' })
  }

  // 重新计算签名
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  const expected = crypto.createHash('sha256').update(`${sorted}&timestamp=${timestamp}&key=${API_SIGN_KEY}`).digest('hex')

  if (sign !== expected) {
    return res.status(403).json({ message: '签名校验失败' })
  }

  next()
}
```

### 3.2 接口限流

信贷类接口必须做严格限流，防止被恶意刷取。

```javascript
const rateLimit = require('express-rate-limit')

// 全局限流
app.use(
  '/api/',
  rateLimit({
    windowMs: 60 * 1000, // 1分钟
    max: 60, // 最多60次
    message: { message: '请求过于频繁' },
  }),
)

// 敏感接口（如提交申请）单独限流
app.use(
  '/api/loan/apply',
  rateLimit({
    windowMs: 60 * 60 * 1000, // 1小时
    max: 5, // 最多5次
    keyGenerator: (req) => req.user.bizId, // 按用户限流
    message: { message: '申请过于频繁，请稍后再试' },
  }),
)

// 验证码接口限流
app.use(
  '/auth/send-code',
  rateLimit({
    windowMs: 60 * 1000,
    max: 1, // 60秒只能发1次
    keyGenerator: (req) => req.body.bizId,
  }),
)
```

### 3.3 防重放攻击

```javascript
function antiReplay(req, res, next) {
  const { timestamp, nonce } = req.body;

  // 1. 时效检查
  if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
    return res.status(403).json({ message: '请求已过期' });
  }

  // 2. nonce 唯一性检查
  const nonceKey = `nonce:${nonce}`;
  if (await redis.exists(nonceKey)) {
    return res.status(403).json({ message: '重复请求' });
  }
  await redis.setex(nonceKey, 600, '1');

  next();
}
```

### 3.4 敏感字段加密传输

即使有 HTTPS，敏感字段也建议应用层加密（防止服务端日志/链路中间件意外记录明文）。

```javascript
// === 前端：RSA 公钥加密敏感字段 ===
import JSEncrypt from 'jsencrypt'

const encryptor = new JSEncrypt()
encryptor.setPublicKey(RSA_PUBLIC_KEY)

function encryptSensitiveFields(data) {
  return {
    ...data,
    idCard: encryptor.encrypt(data.idCard), // 身份证号
    bankCard: encryptor.encrypt(data.bankCard), // 银行卡号
    realName: encryptor.encrypt(data.realName), // 真实姓名
  }
}
```

```javascript
// === 后端：RSA 私钥解密 ===
function decryptField(encryptedValue) {
  const buffer = Buffer.from(encryptedValue, 'base64')
  return crypto.privateDecrypt({ key: RSA_PRIVATE_KEY, padding: crypto.constants.RSA_PKCS1_PADDING }, buffer).toString('utf8')
}
```

---

## 四、业务安全

### 4.1 幂等性控制

防止用户重复提交贷款申请（网络抖动导致重复扣款等）。

```javascript
app.post('/loan/apply', async (req, res) => {
  const idempotencyKey = req.headers['x-idempotency-key']

  // 检查是否已处理过
  const existing = await redis.get(`idempotent:${idempotencyKey}`)
  if (existing) {
    return res.json(JSON.parse(existing)) // 返回之前的结果
  }

  // 加分布式锁，防并发
  const lock = await redis.set(`lock:apply:${req.user.bizId}`, '1', 'EX', 30, 'NX')
  if (!lock) {
    return res.status(409).json({ message: '正在处理中，请勿重复提交' })
  }

  try {
    const result = await processLoanApplication(req.body)
    await redis.setex(`idempotent:${idempotencyKey}`, 3600, JSON.stringify(result))
    res.json(result)
  } finally {
    await redis.del(`lock:apply:${req.user.bizId}`)
  }
})
```

### 4.2 金额/期限篡改防御

**后端必须以服务端配置为准，不信任前端传来的金额、利率、期限。**

```javascript
app.post('/loan/apply', async (req, res) => {
  const { productId, amount, term } = req.body

  // 从数据库读取产品配置（不信任前端）
  const product = await db.findOne('loan_products', { id: productId })

  // 校验金额范围
  if (amount < product.minAmount || amount > product.maxAmount) {
    return res.status(400).json({ message: '金额超出产品范围' })
  }

  // 校验期限是否在允许列表中
  if (!product.allowedTerms.includes(term)) {
    return res.status(400).json({ message: '期限不合法' })
  }

  // 利率由服务端计算，不接受前端传入
  const rate = product.baseRate

  await createLoan({ amount, term, rate, productId })
})
```

### 4.3 操作审计日志

信贷业务必须记录完整的操作链路，用于合规审查和问题追溯。

```javascript
async function auditLog(event) {
  await db.insert('audit_logs', {
    userId: event.userId,
    action: event.action, // 如 'VIEW_CONTRACT', 'SUBMIT_APPLICATION', 'IDENTITY_VERIFY'
    bizId: event.bizId,
    ip: event.ip,
    userAgent: event.userAgent,
    deviceFingerprint: event.fingerprint,
    requestParams: event.params, // 脱敏后的请求参数
    result: event.result, // 'SUCCESS' | 'FAIL'
    failReason: event.failReason,
    timestamp: new Date(),
  })
}

// 在关键节点记录
app.post('/loan/apply', async (req, res) => {
  await auditLog({
    userId: req.user.openId,
    action: 'SUBMIT_APPLICATION',
    bizId: req.body.bizId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    fingerprint: req.headers['x-device-fp'],
    params: { amount: req.body.amount, term: req.body.term }, // 不记录身份证等
    result: 'SUCCESS',
  })
})
```

---

## 五、数据安全

### 5.1 敏感数据脱敏规则

| 字段     | 脱敏规则   | 示例                  |
| -------- | ---------- | --------------------- |
| 手机号   | 保留前3后4 | `138****8832`         |
| 身份证号 | 保留前3后4 | `110***********1234`  |
| 银行卡号 | 保留后4    | `**** **** **** 5678` |
| 姓名     | 保留姓     | `张**`                |
| 地址     | 保留省市   | `广东省深圳市****`    |

```javascript
const maskRules = {
  phone: (v) => v.replace(/^(.{3})(.*)(.{4})$/, '$1****$3'),
  idCard: (v) => v.replace(/^(.{3})(.*)(.{4})$/, '$1***********$3'),
  bankCard: (v) => '**** **** **** ' + v.slice(-4),
  name: (v) => v[0] + '*'.repeat(v.length - 1),
}
```

### 5.2 日志脱敏

**禁止在日志中输出任何明文敏感数据。**

```javascript
function sanitizeForLog(obj) {
  const sensitive = ['idCard', 'bankCard', 'phone', 'realName', 'password']
  const result = { ...obj }
  for (const key of sensitive) {
    if (result[key]) {
      result[key] = maskRules[key]?.(result[key]) || '***'
    }
  }
  return result
}

// 使用
logger.info('Loan application', sanitizeForLog(req.body))
// 输出: { amount: 10000, idCard: '110***********1234', phone: '138****8832' }
```

### 5.3 数据库加密存储

身份证号、银行卡号等在数据库中应加密存储（AES），不能明文。

```javascript
const FIELD_KEY = Buffer.from(process.env.FIELD_ENCRYPT_KEY, 'hex') // 32字节

function encryptField(plaintext) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', FIELD_KEY, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

function decryptField(stored) {
  const [ivHex, encrypted] = stored.split(':')
  const decipher = crypto.createDecipheriv('aes-256-cbc', FIELD_KEY, Buffer.from(ivHex, 'hex'))
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
```

---

## 六、WebView 特有安全问题

### 6.1 URL Scheme 劫持

防止恶意 App 通过自定义 scheme 劫持页面跳转。

```javascript
// 页面中所有跳转必须是白名单域名
const ALLOWED_HOSTS = ['credit.example.com', 'api.example.com']

function safeRedirect(url) {
  try {
    const parsed = new URL(url)
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      console.error('Blocked redirect to:', url)
      return
    }
    window.location.href = url
  } catch {
    console.error('Invalid URL:', url)
  }
}
```

### 6.2 LocalStorage / Cookie 安全

```javascript
// Cookie 设置安全属性
// Set-Cookie: session=xxx; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800

// 不在 localStorage 中存储任何敏感数据
// 不在 URL 参数中传递 token（防 Referer 泄露）
```

### 6.3 第三方资源风控

```nginx
# CSP 严格限制加载来源，防止注入恶意脚本
Content-Security-Policy:
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https://static.example.com;
    connect-src 'self' https://api.example.com;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
```

---

## 七、安全防御全景图

```
┌───────────────────────────────────────────────────────────────┐
│                        传输层                                  │
│   HTTPS强制 · TLS 1.2+ · HSTS · 证书固定                      │
├───────────────────────────────────────────────────────────────┤
│                        网关层                                  │
│   UA检测 · IP限流 · WAF · CSP · X-Frame-Options               │
├───────────────────────────────────────────────────────────────┤
│                        前端层                                  │
│   XSS过滤 · 输入校验 · 敏感数据不落盘 · 防调试 · 水印           │
├───────────────────────────────────────────────────────────────┤
│                        接口层                                  │
│   请求签名 · 防重放 · 限流 · 敏感字段RSA加密 · 幂等控制          │
├───────────────────────────────────────────────────────────────┤
│                        业务层                                  │
│   身份验证(短信+指纹) · 金额校验 · 操作审计 · 风控规则           │
├───────────────────────────────────────────────────────────────┤
│                        数据层                                  │
│   字段AES加密存储 · 日志脱敏 · 展示脱敏 · 最小权限原则           │
└───────────────────────────────────────────────────────────────┘
```

---

## 八、Checklist 速查表

| #   | 安全项                          | 层级   | 优先级  |
| --- | ------------------------------- | ------ | ------- |
| 1   | HTTPS 强制 + HSTS               | 传输层 | P0 必须 |
| 2   | CSP 安全策略                    | 网关层 | P0 必须 |
| 3   | X-Frame-Options 防点击劫持      | 网关层 | P0 必须 |
| 4   | XSS 输入过滤 + 输出转义         | 前端   | P0 必须 |
| 5   | 敏感字段 RSA 加密传输           | 接口层 | P0 必须 |
| 6   | 敏感数据 AES 加密存储           | 数据层 | P0 必须 |
| 7   | 日志脱敏                        | 数据层 | P0 必须 |
| 8   | 操作审计日志                    | 业务层 | P0 必须 |
| 9   | 接口签名防篡改                  | 接口层 | P1 重要 |
| 10  | 接口限流                        | 接口层 | P1 重要 |
| 11  | 防重放（nonce + timestamp）     | 接口层 | P1 重要 |
| 12  | 幂等性控制                      | 业务层 | P1 重要 |
| 13  | 金额/参数服务端校验             | 业务层 | P1 重要 |
| 14  | 展示脱敏                        | 前端   | P1 重要 |
| 15  | 前端敏感数据不落盘              | 前端   | P1 重要 |
| 16  | Cookie Secure/HttpOnly/SameSite | 前端   | P1 重要 |
| 17  | URL 跳转白名单                  | 前端   | P2 推荐 |
| 18  | 页面水印                        | 前端   | P2 推荐 |
| 19  | 防调试检测                      | 前端   | P3 可选 |
| 20  | 证书固定                        | 传输层 | P3 可选 |
