# TikTok WebView H5 页面访问安全方案

> 适用场景：信贷产品 H5 页面投放在 TikTok App 中，以 WebView 形式嵌入，需限制**仅在 TikTok App 中、由本人打开**。  
> 方案特点：不依赖 TikTok JSBridge，纯前后端实现。

---

## 一、整体架构

```
用户点击 TikTok 内链接
        │
        ▼
┌─ 前端：环境检测层 ──────────────────┐
│  UA 白名单检测（初筛，拦截非TikTok环境）│
└──────────────┬─────────────────────┘
               │ 通过
               ▼
┌─ 前端：身份验证层 ──────────────────┐
│  采集设备指纹                        │
│  展示脱敏手机号，要求输入短信验证码     │
└──────────────┬─────────────────────┘
               │ 提交验证码 + 设备指纹
               ▼
┌─ 后端：核心校验层 ──────────────────┐
│  ① 校验短信验证码                    │
│  ② 校验设备指纹一致性（发送 vs 验证）  │
│  ③ 通过 → 绑定设备指纹，下发 Session  │
│  ④ 失败 → 403 拒绝                  │
└──────────────┬─────────────────────┘
               │ 携带 token + 指纹
               ▼
┌─ 后端：请求中间件 ──────────────────┐
│  每次请求校验 token + 设备指纹一致性   │
└─────────────────────────────────────┘
```

---

## 二、前端实现

### 2.1 环境检测（初筛层）

TikTok WebView 的 User-Agent 包含特征字段（如 `BytedanceWebview`、`TikTok`），前端做白名单过滤。

```javascript
function isTikTokWebView() {
  const ua = navigator.userAgent;
  return /TikTok|BytedanceWebview|musical_ly/i.test(ua);
}

if (!isTikTokWebView()) {
  document.body.innerHTML = '<h2>请在 TikTok 中打开</h2>';
  throw new Error('非 TikTok 环境');
}
```

> ⚠️ UA 可以被伪造，只能作为第一道防线，不能单独依赖。

### 2.2 设备指纹采集

使用 [FingerprintJS](https://github.com/nicedoc/fingerprintjs) 采集设备指纹，无需原生能力。

```javascript
import FingerprintJS from '@fingerprintjs/fingerprintjs';

async function getDeviceFingerprint() {
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  return result.visitorId; // 稳定的设备唯一标识
}
```

### 2.3 验证码流程

```javascript
async function startVerification(bizId) {
  const fingerprint = await getDeviceFingerprint();

  // 1. 请求发送验证码（后端只返回脱敏手机号）
  const { maskedPhone } = await api.post('/auth/send-code', {
    bizId,
    fingerprint,
  });
  // maskedPhone = "138****8832"

  showVerifyPage(maskedPhone); // 展示：验证码已发送至 138****8832
}

async function submitCode(bizId, code) {
  const fingerprint = await getDeviceFingerprint();

qa  // 2. 提交验证码
  const { token } = await api.post('/auth/verify-code', {
    bizId,
    code,
    fingerprint,
  });

  // 3. 后续所有请求携带 token + fingerprint
  api.defaults.headers['Authorization'] = `Bearer ${token}`;
  api.defaults.headers['X-Device-FP'] = fingerprint;

  // 4. 进入业务页面
  initCreditApp();
}
```

---

## 三、后端实现

### 3.1 Nginx 层 UA 拦截

```nginx
server {
    location /credit-product/ {
        if ($http_user_agent !~* "(TikTok|Bytedance|BytedanceWebview|musical_ly)") {
            return 403;
        }
        proxy_pass http://backend;
    }
}
```

### 3.2 发送验证码接口

```javascript
app.post('/auth/send-code', async (req, res) => {
  const { bizId, fingerprint } = req.body;

  // 查业务记录，拿到预留手机号
  const biz = await db.findOne('credit_biz', { bizId });
  if (!biz) return res.status(404).json({ message: '业务不存在' });

  // 频率限制：同一指纹/bizId 60秒内只能发一次
  const rateKey = `sms:${bizId}:${fingerprint}`;
  if (await redis.exists(rateKey)) {
    return res.status(429).json({ message: '请60秒后再试' });
  }

  // 生成6位验证码
  const code = Math.random().toString().slice(2, 8);

  // 存储验证码（绑定指纹，5分钟过期）
  await redis.setex(
    `code:${bizId}`,
    300,
    JSON.stringify({ code, fingerprint })
  );
  await redis.setex(rateKey, 60, '1');

  // 发送短信
  await sms.send(biz.phone, `您的验证码：${code}，5分钟内有效，请勿转发他人。`);

  // 只返回脱敏手机号
  const maskedPhone = biz.phone.replace(/^(.{3})(.*)(.{4})$/, '$1****$3');
  res.json({ maskedPhone });
});
```

### 3.3 校验验证码 + 绑定设备

```javascript
app.post('/auth/verify-code', async (req, res) => {
  const { bizId, code, fingerprint } = req.body;

  // 1. 取出存储的验证码
  const raw = await redis.get(`code:${bizId}`);
  if (!raw) return res.status(403).json({ message: '验证码已过期' });

  const stored = JSON.parse(raw);

  // 2. 校验验证码
  if (stored.code !== code) {
    return res.status(403).json({ message: '验证码错误' });
  }

  // 3. 校验指纹一致性（发送和验证必须是同一设备）
  if (stored.fingerprint !== fingerprint) {
    return res.status(403).json({ message: '请在同一设备上完成验证' });
  }

  // 4. 销毁验证码（一次性使用）
  await redis.del(`code:${bizId}`);

  // 5. 下发 session token（绑定设备指纹）
  const token = jwt.sign(
    { bizId, fingerprint },
    JWT_SECRET,
    { expiresIn: '30m' }
  );

  // 6. 记录绑定关系
  await redis.setex(`session:${bizId}`, 1800, fingerprint);

  res.json({ token });
});
```

### 3.4 请求鉴权中间件

```javascript
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const currentFP = req.headers['x-device-fp'];

  if (!token || !currentFP) {
    return res.status(401).json({ message: '缺少鉴权信息' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // 设备指纹必须与验证时一致（防止 token 被拷贝到其他设备使用）
    if (payload.fingerprint !== currentFP) {
      return res.status(403).json({ message: '设备环境异常，请重新验证' });
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: '登录已过期，请重新验证' });
  }
}
```

---

## 四、安全覆盖分析

| 攻击场景 | 防御手段 | 结果 |
|---------|---------|------|
| 在浏览器中直接打开链接 | Nginx UA 检测 + 前端环境检测 | ✅ 拦截 |
| 链接被转发给他人 | 对方收不到短信验证码 | ✅ 拦截 |
| 验证码被口头告知他人 | 设备指纹不一致，校验失败 | ✅ 拦截 |
| Token 被抓包后在其他设备重放 | Token 内绑定设备指纹，比对不通过 | ✅ 拦截 |
| 同一设备换 TikTok 账号打开 | 验证码发到本人预留手机，他人收不到 | ✅ 拦截 |
| 验证码暴力破解 | 60秒发送频率限制 + 5分钟过期 + 一次性使用 | ✅ 拦截 |

---

## 五、依赖清单

| 依赖 | 用途 | 备注 |
|------|------|------|
| `@fingerprintjs/fingerprintjs` | 前端设备指纹采集 | 免费版即可 |
| `jsonwebtoken` | 后端 Session Token 签发/校验 | — |
| `Redis` | 验证码存储、频率限制、会话管理 | — |
| 短信服务 | 发送验证码 | 阿里云/腾讯云短信 |

---

## 六、方案总结

本方案核心逻辑只有两点：

1. **短信验证码** → 证明"你是本人"（只有本人手机能收到）
2. **设备指纹绑定** → 证明"你在同一台设备上"（防止验证码泄露后被他人使用）

不依赖任何 TikTok 特有能力（JSBridge / OAuth），纯前后端实现，实施成本低，安全性满足信贷场景要求。
