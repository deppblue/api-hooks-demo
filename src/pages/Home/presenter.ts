import { useUserService } from '@/utils/hooks/useUserService';
import { useEffect, useState } from 'react';
import { TQueryUserInfoVO } from '@/utils/types';

export const usePresenter = () => {
  const { queryUserInfo } = useUserService();

  const [userInfo, setUserInfo] = useState<TQueryUserInfoVO>();

  const states = {
    userInfo,
  };

  useEffect(() => {
    queryUserInfo({ userId: '123' }).then((res) => {
      setUserInfo(res ?? undefined);
    });
  }, []);

  const events = {
    queryUserInfo,
  };

  return [states, events] as const;
};
