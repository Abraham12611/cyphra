import '@/styles/globals.css';
import '@mysten/dapp-kit/dist/index.css';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import merge from 'lodash.merge';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui.js/client';

// Configure Sui networks
const networks = {
  localnet: { url: getFullnodeUrl('localnet') },
  devnet: { url: getFullnodeUrl('devnet') },
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
};

export default function App({ Component, pageProps }: AppProps) {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="testnet" >
        <WalletProvider autoConnect>
          <SubscriptionProvider>
            <Component {...pageProps} />
            <ToastContainer />
          </SubscriptionProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
