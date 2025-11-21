import axios from 'axios';

export interface SubscriptionStatus {
  isActive: boolean;
  endTime: string | null;
  subscriptionType: string | null;
  autoRenew: boolean;
  lastUpdated?: string;
}

const STORAGE_KEY = 'hive_subscription_status';
const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

export const subscriptionService = {
  async fetchSubscriptionStatus(address: string): Promise<SubscriptionStatus> {
    try {
      console.log(`Fetching subscription status for ${address}`);
      const response = await axios.get(
        `/api/subscription/getSubscriptionStatus?address=${address}`
      );
      const status = response.data.status;

      // Log the response for debugging
      console.log('Subscription API response:', response.data);

      // Validate the response
      if (!status || typeof status.isActive !== 'boolean') {
        console.warn('Invalid subscription status response:', status);
        return this.getDefaultStatus();
      }

      // Ensure all fields are properly formatted
      const formattedStatus: SubscriptionStatus = {
        isActive: Boolean(status.isActive),
        endTime: status.endTime || null,
        subscriptionType: status.subscriptionType || null,
        autoRenew: Boolean(status.autoRenew),
        lastUpdated: new Date().toISOString(),
      };

      // Save to localStorage
      this.saveSubscriptionStatus(formattedStatus);

      return formattedStatus;
    } catch (error) {
      console.error('Error fetching subscription status:', error);

      // Check if we have a cached version before returning default
      const cachedStatus = this.getSubscriptionStatus();
      if (cachedStatus) {
        console.log('Using cached subscription status');
        return cachedStatus;
      }

      return this.getDefaultStatus();
    }
  },

  saveSubscriptionStatus(status: SubscriptionStatus): void {
    if (typeof window !== 'undefined') {
      const statusToSave = {
        ...status,
        lastUpdated: status.lastUpdated || new Date().toISOString(),
      };

      console.log('Saving subscription status to localStorage:', statusToSave);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(statusToSave));

      // Dispatch a custom event to notify other components of the update
      try {
        window.dispatchEvent(
          new CustomEvent('subscription-updated', { detail: statusToSave })
        );
      } catch (e) {
        console.error('Error dispatching subscription-updated event:', e);
      }
    }
  },

  getSubscriptionStatus(): SubscriptionStatus | null {
    if (typeof window !== 'undefined') {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data);
          return parsed;
        }
      } catch (e) {
        console.error(
          'Error parsing subscription status from localStorage:',
          e
        );
        // If there's an error parsing, clear the corrupted data
        this.clearSubscriptionStatus();
      }
    }
    return null;
  },

  clearSubscriptionStatus(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  },

  isSubscriptionActive(): boolean {
    const status = this.getSubscriptionStatus();
    if (!status) return false;

    // Check if the subscription is active and not expired
    if (status.isActive && status.endTime) {
      const endTime = new Date(status.endTime).getTime();
      const now = new Date().getTime();
      return endTime > now;
    }

    return !!status.isActive;
  },

  // Check if the subscription data is stale
  isSubscriptionStale(): boolean {
    const status = this.getSubscriptionStatus();
    if (!status || !status.lastUpdated) return true;

    const lastUpdated = new Date(status.lastUpdated).getTime();
    const now = new Date().getTime();

    return now - lastUpdated > REFRESH_INTERVAL;
  },

  // Return a default status object for new or error cases
  getDefaultStatus(): SubscriptionStatus {
    return {
      isActive: false,
      endTime: null,
      subscriptionType: null,
      autoRenew: false,
      lastUpdated: new Date().toISOString(),
    };
  },

  // Force an immediate refresh from the server
  async forceRefresh(address: string): Promise<SubscriptionStatus> {
    // Clear cache first to ensure we get fresh data
    this.clearSubscriptionStatus();
    return this.fetchSubscriptionStatus(address);
  },
};
