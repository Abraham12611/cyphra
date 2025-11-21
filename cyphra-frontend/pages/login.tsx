import React, { useEffect } from 'react';
import LoginComponent from '@/container/Login';
import Head from 'next/head';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { useRouter } from 'next/router';

const Login = () => {
  const account = useCurrentAccount();
  const router = useRouter();

  useEffect(() => {
    if (account) {
      router.push('/home');
    }
  }, [account, router]);

  return (
    <>
      <Head>
        <title>Hyvve | Login</title>
        <meta
          name="description"
          content="Connect your wallet to access the Hyvve platform"
        />
      </Head>
      <LoginComponent />
    </>
  );
};

export default Login;
