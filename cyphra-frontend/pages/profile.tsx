import React, { useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import dynamic from 'next/dynamic';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useRouter } from 'next/router';
import Head from 'next/head';

const UserProfile = dynamic(() => import('../container/profile/UserProfile'), {
  ssr: false,
});

const Profile = () => {
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
        <title>Hyvve | Profile</title>
        <meta
          name="description"
          content="View and manage your Hyvve profile"
        />
      </Head>
      <Layout>
        <div className="ml-[250px]">
          <UserProfile />
        </div>
      </Layout>
    </>
  );
};

export default Profile;
