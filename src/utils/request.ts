import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';
import { message } from 'antd';

// 响应数据结构
export interface ResponseData<T = any> {
  code: number;
  data: T;
  message: string;
  success: boolean;
}

// 创建 axios 实例
const http: AxiosInstance = axios.create({
  baseURL: process.env.API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
http.interceptors.request.use(
  (config) => {
    // 从 localStorage 获取 token
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    console.error('请求错误:', error);
    return Promise.reject(error);
  },
);

// 响应拦截器
http.interceptors.response.use(
  (response: AxiosResponse<ResponseData>) => {
    const { data } = response;

    // 如果是下载文件等特殊情况，直接返回
    if (response.config.responseType === 'blob') {
      return response;
    }

    // 业务成功
    if (data.success || data.code === 0 || data.code === 200) {
      return response;
    }

    // 业务失败
    message.error(data.message || '请求失败');
    return Promise.reject(new Error(data.message || '请求失败'));
  },
  (error: AxiosError<ResponseData>) => {
    // 处理 HTTP 错误
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          message.error('未授权，请重新登录');
          // 清除 token
          localStorage.removeItem('token');
          // 跳转到登录页
          window.location.href = '/login';
          break;
        case 403:
          message.error('拒绝访问');
          break;
        case 404:
          message.error('请求的资源不存在');
          break;
        case 500:
          message.error('服务器错误');
          break;
        case 502:
          message.error('网关错误');
          break;
        case 503:
          message.error('服务不可用');
          break;
        case 504:
          message.error('网关超时');
          break;
        default:
          message.error(data?.message || `请求失败: ${status}`);
      }
    } else if (error.request) {
      // 请求已发出，但没有收到响应
      message.error('网络错误，请检查网络连接');
    } else {
      // 其他错误
      message.error(error.message || '请求失败');
    }

    return Promise.reject(error);
  },
);

// 封装请求方法
export const request = {
  get: <T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<ResponseData<T>> => {
    return http.get(url, config).then((res) => res.data);
  },

  post: <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<ResponseData<T>> => {
    return http.post(url, data, config).then((res) => res.data);
  },

  put: <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<ResponseData<T>> => {
    return http.put(url, data, config).then((res) => res.data);
  },

  delete: <T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<ResponseData<T>> => {
    return http.delete(url, config).then((res) => res.data);
  },

  patch: <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<ResponseData<T>> => {
    return http.patch(url, data, config).then((res) => res.data);
  },
};

export default http;
