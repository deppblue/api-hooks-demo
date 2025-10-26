import { sendVerifyMessage as soaSendVerifyMessage } from '../soa';
import { SendVerifyMessageParams } from '../types';
import { useCallback } from 'react';

export const sendVerifyMessage = async (params: SendVerifyMessageParams) => {
  const result = await soaSendVerifyMessage(params);
  if (!result.data) {
    return null;
  }
  return result.data;
};

export const useVerifyService = () => {
  return {
    sendVerifyMessage: useCallback(sendVerifyMessage, [soaSendVerifyMessage]),
  };
};
