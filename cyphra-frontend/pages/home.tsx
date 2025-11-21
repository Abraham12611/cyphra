import React, { useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import UserHome from '@/container/home/UserHome';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useRouter } from 'next/router';

const Home = () => {
  const account = useCurrentAccount();
  const router = useRouter();

  useEffect(() => {
    if (!account) {
      router.push('/login');
    }
  }, [account, router]);

  return (
    <>
      <Layout>
        <div className={account ? 'ml-[250px]' : ''}>
          {account ? <UserHome /> : null}
        </div>
      </Layout>
    </>
  );
};

export default Home;
