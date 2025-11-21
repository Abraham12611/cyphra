import React, { useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import ActiveCampaigns from '@/container/campaigns/ActiveCampaigns';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useRouter } from 'next/router';
import Head from 'next/head';

const Campaigns = () => {
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
        <title>Hyvve | Campaigns</title>
        <meta
          name="description"
          content="Browse active data collection campaigns on Hyvve"
        />
      </Head>
      <Layout>
        <div className="ml-[250px]">
          <ActiveCampaigns />
        </div>
      </Layout>
    </>
  );
};

export default Campaigns;
