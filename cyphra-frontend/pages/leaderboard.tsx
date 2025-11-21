import React, { useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import UserLeaderboard from '@/container/leaderboard/UserLeaderboard';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useRouter } from 'next/router';
import Head from 'next/head';

const Leaderboard = () => {
  const account = useCurrentAccount();
  const router = useRouter();

  useEffect(() => {
    if (!account) {
      router.push('/login');
    }
  }, [account, router]);

  if (!account) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Hyvve | Leaderboard</title>
        <meta
          name="description"
          content="View top contributors on the Hyvve platform"
        />
      </Head>
      <Layout>
        <div className="ml-[250px]">
          <UserLeaderboard />
        </div>
      </Layout>
    </>
  );
};

export default Leaderboard;
