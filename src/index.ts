import axios from "axios";
import { createPipelineClient, type PipelineClient } from "./core/orchestrator";
import { createTransformerPlugin, TransformerRegistry } from "./core/transformer";
import type { ApiResult, ApiVo } from "./core/types";
import {
  apiCatalog,
  mockTenantStatDto,
  mockUserProfileDto,
  type DemoApiCatalog,
  type TenantStatDto,
  type TenantStatVo,
  type UserProfileDto,
  type UserProfileVo,
} from "./demo/apiCatalog";
import {
  createLoggingPlugin,
  createMockPlugin,
  createRuntimeContextPlugin,
} from "./demo/plugins";

// 运行时上下文，统一管理 token / tenantId
const runtimeState = {
  token: "demo-token-001",
  tenantId: "tenant-001",
};

const runtimeContext = {
  getToken: () => runtimeState.token,
  getTenantId: () => runtimeState.tenantId,
};

// DTO -> VO 转换器注册
const transformerRegistry = new TransformerRegistry();
transformerRegistry.register("userProfile", transformUserProfile);
transformerRegistry.register("tenantStat", transformTenantStat);

// 组合插件并构建流水线客户端
const client: PipelineClient<DemoApiCatalog> = createPipelineClient({
  axiosInstance: axios.create({
    baseURL: "https://example-api.test",
    timeout: 5_000,
  }),
  catalog: apiCatalog,
  plugins: [
    createRuntimeContextPlugin(runtimeContext),
    createMockPlugin(),
    createTransformerPlugin(),
    createLoggingPlugin(),
  ],
  shared: {
    transformerRegistry,
  },
});

async function runDemo() {
  console.log("🎯 Demo 流程：使用统一 Pipeline 执行两个接口，并输出转换后的 VO 数据\n");

  const userProfileResult = await client.execute("user.profile.get", {
    params: { userId: "u-001" },
    mockResponse: mockUserProfileDto,
  });
  reportResult("user.profile.get", userProfileResult);

  const tenantStatResult = await client.execute("tenant.stat.get", {
    params: { tenantId: "tenant-001" },
    mockResponse: mockTenantStatDto,
  });
  reportResult("tenant.stat.get", tenantStatResult);

  console.log("\n💡 更新 token 后再次发起请求，演示动态参数注入效果\n");
  runtimeState.token = "demo-token-002";
  const secondResult = await client.execute("user.profile.get", {
    params: { userId: "u-001", verbose: true },
    mockResponse: mockUserProfileDto,
  });
  reportResult("user.profile.get (second)", secondResult);

  console.log(
    "\n✅ Demo 完成，可查看 README 获取架构说明与更多细节。\n"
  );
}

runDemo().catch((error) => {
  console.error("Demo 运行异常", error);
});

function reportResult<Key extends keyof DemoApiCatalog>(
  key: Key,
  result: ApiResult<ApiVo<DemoApiCatalog, Key>>
) {
  if (result.error) {
    console.error(`❌ ${key} 失败`, result.error);
    return;
  }
  console.log(`✅ ${key} 成功，响应 VO:`, result.data);
  console.log("   请求头：", result.context.requestConfig.headers);
}

function transformUserProfile(dto: UserProfileDto): UserProfileVo {
  return {
    id: dto.id,
    displayName: dto.name,
    phone: dto.phone_number,
    createdAt: dto.created_at,
    isNewUser: Date.now() - Date.parse(dto.created_at) < 7 * 24 * 60 * 60 * 1000,
  };
}

function transformTenantStat(dto: TenantStatDto): TenantStatVo {
  const rate = dto.active_rate;
  return {
    tenantId: dto.tenant_id,
    totalUser: dto.total_user,
    activeRate: rate,
    friendlyActiveRate: `${Math.round(rate * 100)}%`,
  };
}
