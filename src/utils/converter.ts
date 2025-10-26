import { TQueryUserInfoResult, TQueryUserInfoVO } from './types';

export const convertToUserInfo = (dataDTO: TQueryUserInfoResult) => {
  const { id, name, nickName, email, phone, avatar } = dataDTO;
  return {
    id,
    name,
    nickName,
    email,
    phone,
    avatar,
  } as TQueryUserInfoVO;
};
