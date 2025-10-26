import { AxiosRequestConfig } from 'axios';
import request from './request';
import {
  SendVerifyMessageParams,
  TLoginParams,
  TLoginResult,
  TQueryUserInfoParams,
  TQueryUserInfoResult,
} from './types';

const baseUrl = 'https://api.example.com';
const api = {
  sendVerifyMessage: '/api/sendVerifyMessage',
  login: '/api/login',
  queryUserInfo: '/api/queryUserInfo',
};

export async function sendVerifyMessage(params: SendVerifyMessageParams) {
  return request.post(baseUrl + api.sendVerifyMessage, params);
}

export async function login(params: TLoginParams) {
  return request.post<TLoginResult>(baseUrl + api.login, params);
}

export async function queryUserInfo(params: TQueryUserInfoParams) {
  return request.post<TQueryUserInfoResult>(
    baseUrl + api.queryUserInfo,
    params,
  );
}
