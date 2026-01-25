# 通用 API Hooks 流水线 Demo

> 🎯 目标：通过一个最小可运行示例，快速体验“运行时插件化 Pipeline + DTO→VO 转换 + React Hook 适配”的核心思路，减少项目间重复造轮子。

---

## 🚀 快速体验

```bash
npm install
npm run demo
```

运行命令后可在终端看到：

- 统一 Pipeline 依次执行 `mock → axios 请求 → DTO→VO 转换 → 日志`
- token / 租户 ID 被自动注入请求头并打印
- DTO 转换为 VO 后返回给调用侧

如需验证动态参数，可自行修改 `src/index.ts` 中的 `runtimeState` 或 `mock` 数据。

---

## 🏗️ 架构分层概览

| 分层 | 作用 | Demo 中的落地文件 |
| --- | --- | --- |
| **Core Layer** | 与框架解耦的通用逻辑：插件 Pipeline、axios 封装、错误规范、DTO→VO 转换 | `src/core/*` |
| **Adapter Layer** | React 适配，仅负责状态管理与生命周期 | `src/react/useApiRequest.ts` |
| **Configuration Layer** | API 元信息、转换器、默认插件组合 | `src/demo/apiCatalog.ts` + `src/demo/plugins.ts` |
| **Demo Layer** | 场景化示例，演示如何组装核心能力 | `src/index.ts` |

当前 Demo 聚焦运行时能力，不包含缓存与 CLI，实现“可复用 + 易扩展 + 可观察”的最小闭环。

---

## 🔁 流水线执行流程

1. **Resolve API**：根据 API key 读取 `apiCatalog` 中的元信息（方法、URL、转换器）。
2. **Pipeline 初始化**：合并全局共享上下文（transformerRegistry 等），实例化 `PipelineContext`。
3. **beforePrepare**：预处理参数、构建 axios `requestConfig`。
4. **beforeRequest**：动态注入 token / 租户 ID、附加 headers。
5. **onRequest**：插件链调用。Demo 中的 `mock` 插件可直接返回模拟数据；若没有 mock，则落到 axios 实际请求。
6. **afterResponse**：核心转换插件读取 DTO → 生成 VO 并写入上下文。
7. **afterSuccess / afterError**：记录日志、抛出统一的 `ApiError` / 返回 `ApiResult`。
8. **Adapter 派发**：Headless 直接拿到 `ApiResult`；React Hook 读取结果更新组件 state。

> ⚙️ 整条链路只依赖声明式插件，不需要修改 Core 代码即可扩展新能力。

---

## 📂 目录结构建议

```
src/
├─ core/               # 框架无关的核心逻辑
│  ├─ error.ts
│  ├─ orchestrator.ts  # createPipelineClient
│  ├─ pipeline.ts      # PipelineEngine
│  ├─ pluginManager.ts
│  ├─ transformer.ts
│  └─ types.ts
├─ demo/               # 示例用的 API 定义与插件
│  ├─ apiCatalog.ts
│  └─ plugins.ts
├─ react/              # React 适配层示例
│  └─ useApiRequest.ts
└─ index.ts            # Demo 入口（Headless 调用）
```

业务项目可将 `core` 与 `react` 抽离成独立 package，通过 npm 复用；`demo` 则迁移到各业务仓库的具体实现。

---

## 🧠 设计要点摘要

- **插件化 Pipeline**：将请求链路拆分为多个阶段，开发者只需新增插件即可扩展能力（动态注入、重试、Mock、日志等）。
- **Headless First**：Core 与 React 解耦，非 React 场景直接调用 `client.execute` 即可获得统一行为。
- **DTO→VO 转换**：集中管理转换器，保证类型安全、字段命名统一，避免每个项目重复处理。
- **错误标准化**：所有错误收敛为 `ApiError`，React Hook 内部只关心统一结构，提高跨项目可维护性。
- **无缓存前提**：当前 Demo 不包含缓存模块，后续如需引入，可通过新增插件介入 `afterResponse` 阶段。

---

## 🔌 插件与共享上下文

Demo 中内置了三个插件，可作为自定义插件编写的模板：

| 插件 | 阶段 | 功能 |
| --- | --- | --- |
| `runtime-context` | `beforeRequest` | 注入 token / 租户 ID 等动态参数 |
| `mock-response` | `onRequest` | 在本地开发或单测中直接返回模拟数据 |
| `logging` | `afterSuccess` / `afterError` | 打印关键信息，便于调试 |

统一的转换器注册表 `TransformerRegistry` 通过 `shared` 注入 Pipeline，全局共享，无需在每个请求里重复创建。

---

## 🧪 React Hook 适配示例

`src/react/useApiRequest.ts` 展示了如何在 React 中包裹 `PipelineClient`：

```tsx
const client = useMemo(() => bootstrapClient(), []);

const { data, loading, error, refetch } = useApiRequest(
  client,
  "user.profile.get",
  {
    params: { userId: "u-001" },
  },
  {
    manual: false,
    deps: [userId],
  }
);
```

- 组件无需关心 axios、token 注入、DTO→VO 转换等细节。
- 通过 `manual` 与 `refetch` 控制触发时机，便于组合到现有业务组件。
- Hook 内部已做好竞态保护，不会因旧请求返回导致数据回退。

---

## 📌 扩展建议（与 Demo 一致的设计思想）

1. **类型生成**：结合现有 OpenAPI 定义，编写脚本生成 `apiCatalog`、DTO 类型与转换器模版。
2. **插件生态**：逐步补充重试、节流、限流、结构化日志等插件，并形成目录规范。
3. **测试基座**：提供 `createTestPipeline` 助手，隔离验证插件逻辑；Mock 插件可用于端到端演练。
4. **文档与示例**：为每个插件、Hook 编写简短用法说明，保证团队成员快速上手。

> ❗️根据业务需求，该方案默认不引入缓存层与 CLI 工具，后续如需能力扩展，可在保持 Pipeline 结构的前提下按需补充。

---

## ✅ 下一步行动建议

1. 在真实业务项目中落地 `core` & `react` 包，替换现有手写请求逻辑。
2. 结合团队的 OpenAPI 管理流程，补齐类型生成脚本与 CI 校验。
3. 根据业务痛点优先实现必要插件（如自动重试、错误上报），并编写配套单测。

欢迎在此 Demo 基础上继续演进，沉淀为团队统一的 API Hooks 基础设施。祝使用顺利 ✨


























## 缺陷总体洞察

这 8 个 bug 大致可以分成两类：功能问题和交互体验问题。

### 功能缺陷

**状态管理问题**：语言切换后页面没刷新，配置改了但组件没监听到变化；关闭弹窗就把上传取消了，上传逻辑和弹窗绑得太死。

**接口调用问题**：文件上传没检查返回结果就直接显示成功；更新用户详情时忘记传 id 参数了。

**业务逻辑问题**：表单字段明明是可选的，结果做成必填了；文件同名判断只看文件名，后缀不同其实不算同名，但代码里没考虑这个。

### 交互体验

**表单校验**：字段没做判空，用户填错了也没提示。

**UI 展示**：文字太长没换行，超出部分直接溢出，看起来很难受。

## 问题分析

语言切换没刷新的问题，主要是 useMemo 和 useCallback 的依赖没设置好，组件没监听到配置变化，所以没重新渲染。关闭弹窗就取消上传这个，设计上就有问题，上传应该做成独立的后台任务，不应该和弹窗生命周期绑在一起。

字段没判空、可选字段做成必填，说明校验规则和 UI 配置对不上。文字不换行就是样式没处理好，CSS 加个换行和超出隐藏就能解决。

文件上传没检查接口返回就显示成功，这个太危险了，万一上传失败用户还以为成功了。同名文件判断只看文件名不看后缀，对业务理解有偏差，实际上 `test.jpg` 和 `test.png` 是两个不同的文件。

更新用户详情没传 id，调用接口时参数检查不够仔细，漏了这个关键参数。

## 总结

开发时验证意识不够，状态变更没同步、接口调用没检查返回值、业务逻辑理解也不够深入。后面得加强自测，特别是那些边界场景。

## 需要加强的方面

### 1. 代码质量，需加强自测

上面这些缺陷已经能说明问题了，重点是要加强边界场景和异常流程的验证。

### 2. 技术决策不到位

**时间格式错配**：前端传给后端的时间是带本地时区的格式化字符串，不同时区的用户调用时时间就不一致了，这个设计有问题。

**密码加密未落地**：技术方案里没明确加密算法、盐值策略和密钥管理，结果实现时要么传明文，要么随便选个方案，没有统一规范。

### 3. 进度把控

作为项目负责人，不能只盯着自己的任务，得关注整个团队的进度。只关注自己这边的话，整体进度容易失控，最后影响交付。

### 4. 代码审查（Code Review）

代码审查流程得严格把控，要有明确的审查标准和准入条件，不能随便就合并了。建议搞个 CR Checklist，确保代码质量、安全性和规范性的统一。
