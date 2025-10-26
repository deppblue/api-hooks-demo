import { convertToUserInfo } from '../converter';
import { queryUserInfo as soaQueryUserInfo, login as soaLogin } from '../soa';
import { TLoginParams, TQueryUserInfoParams } from '../types';
import { useCallback } from 'react';

export const queryUserInfo = async (params: TQueryUserInfoParams) => {
  const result = await soaQueryUserInfo(params);
  if (!result.data) {
    return null;
  }
  return convertToUserInfo(result.data);
};

export const login = async (params: TLoginParams) => {
  const result = await soaLogin(params);
  if (!result.data) {
    return null;
  }
  return result.data;
};

export const useUserService = () => {
  return {
    queryUserInfo: useCallback(queryUserInfo, [soaQueryUserInfo]),
    login: useCallback(login, [soaLogin]),
  };
};
