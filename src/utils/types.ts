export interface ResponseData<T = any> {
  code: number;
  data: T;
  message: string;
  success: boolean;
}

export interface SendVerifyMessageParams {
  phone: string;
  code: string;
}

export interface TLoginParams {
  phone: string;
  code: string;
}

export interface TLoginResult {
  token: string;
}

export interface TQueryUserInfoParams {
  userId: string;
}

export interface TQueryUserInfoResult {
  id: string;
  name: string;
  nickName: string;
  email: string;
  phone: string;
  avatar: string;
  gender: string;
  birthDate: string;
  address: string;
  city: string;
  province: string;
  country: string;
}

export interface TQueryUserInfoVO {
  id: string;
  name: string;
  nickName: string;
  email: string;
  phone: string;
  avatar: string;
}
