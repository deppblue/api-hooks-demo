import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import styles from './index.less';
import { usePresenter } from './presenter';
const HomePage: React.FC = () => {
  const { name } = useModel('global');
  const [states, events] = usePresenter();

  const { userInfo } = states;

  return (
    <PageContainer ghost>
      <div className={styles.container}>{userInfo?.name}</div>
    </PageContainer>
  );
};

export default HomePage;
