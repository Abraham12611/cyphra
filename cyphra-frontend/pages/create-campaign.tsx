import React, { useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import CampaignMultiStep from '@/container/create-campaign/CampaignMultiStep';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useRouter } from 'next/router';
import Head from 'next/head';

const CreateCampaign = () => {
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
        <title>Hyvve | Create Campaign</title>
        <meta
          name="description"
          content="Create a new data collection campaign on Hyvve"
        />
      </Head>
      <Layout>
        <div className="">
          <CampaignMultiStep />
        </div>
      </Layout>
    </>
  );
};

export default CreateCampaign;
