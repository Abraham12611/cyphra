import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import {
  subscriptionService,
  SubscriptionStatus,
} from '@/utils/subscription/subscriptionService';

interface SubscriptionContextType {
  subscriptionStatus: SubscriptionStatus | null;
  isLoading: boolean;
  error: string | null;
  refreshSubscription: () => Promise<void>;
  isSubscribed: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscriptionStatus: null,
  isLoading: false,
  error: null,
  refreshSubscription: async () => {},
  isSubscribed: false,
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const account = useCurrentAccount();
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [forceRefresh, setForceRefresh] = useState<number>(0);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef<boolean>(false);

  // Track the current connected account address to detect changes
  const previousAccountRef = useRef<string | null>(null);

  // This function is used to fetch subscription status from the API
  const fetchSubscriptionStatus = useCallback(async (address: string) => {
    // Prevent concurrent refreshes
    if (isRefreshingRef.current) {
      console.log('Skipping fetch - already refreshing');
      return null;
    }

    isRefreshingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Fetching subscription status for ${address}`);
      const status = await subscriptionService.fetchSubscriptionStatus(address);
      setSubscriptionStatus(status);
      return status;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch subscription status');
      console.error('Error fetching subscription:', err);
      return null;
    } finally {
      setIsLoading(false);
      isRefreshingRef.current = false;
    }
  }, []);

  // Public function to force a refresh of subscription data
  const refreshSubscription = useCallback(async (): Promise<void> => {
    if (account) {
      // Clear any pending refresh
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      await fetchSubscriptionStatus(account.address);
      // Force a UI update by incrementing the forceRefresh counter
      setForceRefresh((prev) => prev + 1);
    } else {
      console.warn('Cannot refresh subscription: No connected account');
    }
  }, [account, fetchSubscriptionStatus]);

  // Listen for subscription-updated events
  useEffect(() => {
    const handleSubscriptionUpdated = (event: CustomEvent) => {
      console.log('Received subscription-updated event:', event.detail);
      if (event.detail) {
        setSubscriptionStatus(event.detail);
      }
    };

    // Add event listener with type assertion
    window.addEventListener(
      'subscription-updated',
      handleSubscriptionUpdated as EventListener
    );

    return () => {
      window.removeEventListener(
        'subscription-updated',
        handleSubscriptionUpdated as EventListener
      );
    };
  }, []);

  // Load from localStorage on initial render
  useEffect(() => {
    const savedStatus = subscriptionService.getSubscriptionStatus();
    if (savedStatus) {
      console.log(
        'Loading subscription status from localStorage:',
        savedStatus
      );
      setSubscriptionStatus(savedStatus);
    }
  }, []);

  // Fetch subscription status when wallet connects or when data is stale
  useEffect(() => {
    // Check if the account has changed
    const accountChanged = account?.address !== previousAccountRef.current;

    if (account) {
      // Always update the ref to current account
      previousAccountRef.current = account.address;

      // Check if we need to refresh the data:
      // 1. If account has changed - always refresh
      // 2. If no subscription data exists
      // 3. If data is stale
      const needsRefresh =
        accountChanged ||
        !subscriptionStatus ||
        subscriptionService.isSubscriptionStale();

      if (needsRefresh) {
        console.log(
          'Fetching subscription status:',
          accountChanged
            ? 'Account changed'
            : !subscriptionStatus
            ? 'No cached data'
            : 'Data is stale'
        );

        // Add a small delay to avoid immediate refresh on every render
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }

        refreshTimeoutRef.current = setTimeout(() => {
          fetchSubscriptionStatus(account.address);
        }, 100);
      }
    } else {
      // Clear subscription status when wallet disconnects
      previousAccountRef.current = null;
      setSubscriptionStatus(null);
      subscriptionService.clearSubscriptionStatus();
    }

    // Cleanup timeout on unmount
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [account, subscriptionStatus, fetchSubscriptionStatus, forceRefresh]);

  // Compute whether user is subscribed based on status
  const isSubscribed = React.useMemo(() => {
    if (!subscriptionStatus) return false;

    // Check both active flag and expiration date
    if (subscriptionStatus.isActive && subscriptionStatus.endTime) {
      const endTime = new Date(subscriptionStatus.endTime).getTime();
      const now = Date.now();
      return endTime > now;
    }

    return subscriptionStatus.isActive;
  }, [subscriptionStatus]);

  return (
    <SubscriptionContext.Provider
      value={{
        subscriptionStatus,
        isLoading,
        error,
        refreshSubscription,
        isSubscribed,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};
