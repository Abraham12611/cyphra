import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import dynamic from 'next/dynamic';
import SubscriptionModal from '../modals/SubscriptionModal';
import { useSubscription } from '@/context/SubscriptionContext';
import {
  HiSparkles,
  HiOutlineStar,
  HiOutlineArrowUp,
  HiOutlineCheck,
} from 'react-icons/hi';
import Login from '@/container/Login';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { ConnectButton } from '@mysten/dapp-kit';
import { toast } from 'react-toastify';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMintModalOpen, setIsMintModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const { isSubscribed, isLoading, subscriptionStatus, refreshSubscription } =
    useSubscription();
  const account = useCurrentAccount();

  console.log('subscriptionStatus', subscriptionStatus);

  // Listen for custom event to open subscription modal
  useEffect(() => {
    const handleOpenSubscriptionModal = () => {
      setIsSubscriptionModalOpen(true);
    };

    window.addEventListener(
      'open-subscription-modal',
      handleOpenSubscriptionModal
    );

    return () => {
      window.removeEventListener(
        'open-subscription-modal',
        handleOpenSubscriptionModal
      );
    };
  }, []);

  const handleSubscriptionButtonClick = () => {
    if (isSubscribed) {
      toast.success('You have an active subscription!', {
        position: 'top-right',
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: 'dark',
        icon: '✨',
        style: {
          background: '#0f0f17',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          borderRadius: '10px',
        },
      });
    } else {
      setIsSubscriptionModalOpen(true);
    }
  };

  return (
    <>
      {account ? (
        <div>
          <Sidebar />
          <div className="flex items-center gap-2 justify-end absolute top-6 right-10 ">
            <button className="border border-gray-800 rounded-lg text-sm p-2 px-4 flex items-center gap-2">
              <img
                src="/sui-logo.svg"
                alt=""
                className="w-[28px] h-[28px] p-1 rounded-2xl"
              />
              SUI
            </button>

            <button
              onClick={handleSubscriptionButtonClick}
              className={`relative group overflow-hidden rounded-lg text-sm p-2 px-4 transition-all duration-300 ${
                isSubscribed
                  ? 'bg-gradient-to-r from-[#6366f1]/20 to-[#a855f7]/20 hover:from-[#6366f1]/30 hover:to-[#a855f7]/30 border border-[#a855f7]/30'
                  : 'bg-gradient-to-r from-[#6366f1] to-[#a855f7] hover:from-[#a855f7] hover:to-[#6366f1] text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30'
              }`}
            >
              {/* Animated background effect - only for Premium Active state */}
              {isSubscribed && (
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-[#6366f1]/0 via-[#a855f7]/20 to-[#6366f1]/0 -translate-x-full animate-shimmer"></span>
              )}

              {/* Animated glow effect - only for Upgrade state */}
              {!isSubscribed && (
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-purple-600/0 via-purple-600/40 to-purple-600/0 -translate-x-full animate-shimmer"></span>
              )}

              <div className="flex items-center gap-2 relative z-10">
                <div className="relative">
                  {isSubscribed ? (
                    <>
                      <HiSparkles className="h-4 w-4 text-[#a855f7]" />
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]"></span>
                      </span>
                    </>
                  ) : (
                    <HiOutlineArrowUp className="h-4 w-4 text-white animate-bounce" />
                  )}
                </div>

                <span
                  className={`font-medium ${!isSubscribed && 'font-semibold'}`}
                >
                  {isSubscribed ? 'Premium Active' : 'Upgrade to Premium'}
                </span>
              </div>
            </button>

            <ConnectButton />
          </div>
          {children}

          <SubscriptionModal
            isOpen={isSubscriptionModalOpen}
            onClose={() => setIsSubscriptionModalOpen(false)}
          />

          {/* <MintTokensModal
            isOpen={isMintModalOpen}
            onClose={() => setIsMintModalOpen(false)}
          /> */}
        </div>
      ) : (
        <Login />
      )}
    </>
  );
};

export default Layout;
