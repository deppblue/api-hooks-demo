import type { ApiCatalogItem } from "../core/types";
import { defineApiCatalog } from "../core/types";

export interface UserProfileDto {
  id: string;
  name: string;
  phone_number: string;
  created_at: string;
}

export interface UserProfileVo {
  id: string;
  displayName: string;
  phone: string;
  createdAt: string;
  isNewUser: boolean;
}

export interface TenantStatDto {
  tenant_id: string;
  total_user: number;
  active_rate: number;
}

export interface TenantStatVo {
  tenantId: string;
  totalUser: number;
  activeRate: number;
  friendlyActiveRate: string;
}

export const apiCatalog = defineApiCatalog({
  "user.profile.get": {
    method: "GET",
    url: "/users/:userId",
    transformKey: "userProfile",
    description: "获取指定用户的详情信息",
  } as ApiCatalogItem<
    { userId: string; verbose?: boolean },
    undefined,
    UserProfileDto,
    UserProfileVo
  >,
  "tenant.stat.get": {
    method: "GET",
    url: "/tenants/:tenantId/stat",
    transformKey: "tenantStat",
    description: "获取租户统计信息",
  } as ApiCatalogItem<
    { tenantId: string; includeInactive?: boolean },
    undefined,
    TenantStatDto,
    TenantStatVo
  >,
});

export type DemoApiCatalog = typeof apiCatalog;

export const mockUserProfileDto: UserProfileDto = {
  id: "u-001",
  name: "张三",
  phone_number: "18800001111",
  created_at: "2024-02-01T08:20:00.000Z",
};

export const mockTenantStatDto: TenantStatDto = {
  tenant_id: "tenant-001",
  total_user: 128,
  active_rate: 0.76,
};
