import React, { useState } from 'react';
import { TypeSelector } from './step-components/TypeSelector';
import { useCampaign } from '@/context/CampaignContext';
import {
  HiOutlineDocument,
  HiOutlinePhotograph,
  HiLockClosed,
} from 'react-icons/hi';
import { useSubscription } from '@/context/SubscriptionContext';
import { toast } from 'react-toastify';

interface PlanType {
  name: string;
  icon: React.ReactNode;
  description: string;
  isPremium?: boolean;
}

const campaignTypes: PlanType[] = [
  {
    name: 'Text',
    icon: <HiOutlineDocument className="w-6 h-6 text-white" />,
    description: 'Collect text-based data from your community',
    isPremium: false,
  },
  {
    name: 'Image',
    icon: <HiOutlinePhotograph className="w-6 h-6 text-white" />,
    description: 'Collect image-based data from your community',
    isPremium: true,
  },
];

const CampaignType = () => {
  const [isDisabled, setIsDisabled] = useState(false);
  const { updateCampaignType, errors, campaignData } = useCampaign();
  const { isSubscribed } = useSubscription();

  // Set premium enabled based on subscription status
  const isPremiumEnabled = isSubscribed;

  const handleTypeChange = (type: PlanType) => {
    // If trying to select a premium type without subscription, show a toast
    if (type.isPremium && !isPremiumEnabled) {
      toast.info('This feature requires a premium subscription', {
        position: 'top-right',
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: 'dark',
        icon: <HiLockClosed className="text-amber-400" />,
        style: {
          background: '#0f0f17',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          borderRadius: '10px',
        },
      });
      return;
    }

    updateCampaignType(type);
  };

  // Test controls for debugging
  const toggleDisabled = () => setIsDisabled((prev) => !prev);

  return (
    <div className="w-[898px] mx-auto">
      <div className="flex flex-col items-center">
        <h1 className="text-white text-lg font-semibold text-center">
          What type of campaign would you like to create?
        </h1>
        <p className="text-gray-300 text-sm font-semibold mt-4">
          Select the type of campaign you want to create
        </p>

        {errors.type && (
          <p className="text-red-500 text-sm mt-2">{errors.type}</p>
        )}

        {!isSubscribed && (
          <div className="mt-4 p-3 bg-amber-900/30 border border-amber-700/50 rounded-md text-amber-200 text-sm w-full max-w-md">
            <p className="flex items-center">
              <HiLockClosed className="mr-2" />
              Image campaign types require an active subscription.{' '}
              {/* <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();

                  window.dispatchEvent(
                    new CustomEvent('open-subscription-modal')
                  );
                }}
                className="ml-1 underline hover:text-amber-100"
              >
                Upgrade now
              </a>{' '}
              to access all features. */}
            </p>
          </div>
        )}

        <div className="flex justify-center gap-16 mt-9 ml-16">
          <TypeSelector
            types={campaignTypes}
            selectedType={campaignData.type}
            disabled={isDisabled}
            premiumEnabled={isPremiumEnabled}
            onTypeChange={handleTypeChange}
          />
        </div>
      </div>
    </div>
  );
};

export default CampaignType;
