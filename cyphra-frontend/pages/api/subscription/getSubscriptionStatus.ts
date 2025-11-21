import { NextApiRequest, NextApiResponse } from 'next';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

interface SubscriptionStatus {
  isActive: boolean;
  endTime: string | null; // ISO date string
  subscriptionType: string | null;
  autoRenew: boolean;
}

function formatEndTime(timestamp: number): string | null {
  if (timestamp === 0 || isNaN(timestamp) || timestamp <= 0) {
    return null;
  }
  return new Date(timestamp * 1000).toISOString();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ message: 'Address is required' });
  }

  try {
    const PACKAGE_ID = process.env.NEXT_PUBLIC_CAMPAIGN_MANAGER_PACKAGE_ID;
    const SUBSCRIPTION_STORE_ID = process.env.NEXT_PUBLIC_SUBSCRIPTION_STORE_ID;
    const networkEnv = process.env.NETWORK || 'testnet';

    if (!PACKAGE_ID || !SUBSCRIPTION_STORE_ID) {
      console.error(
        'Missing environment variables: CAMPAIGN_MANAGER_PACKAGE_ID or SUBSCRIPTION_STORE_ID'
      );
      return res.status(500).json({
        message: 'Server configuration error: Missing package/store IDs',
      });
    }

    const rpcUrl = getFullnodeUrl(
      networkEnv as 'testnet' | 'mainnet' | 'devnet' | 'localnet'
    );
    const client = new SuiClient({ url: rpcUrl });

    let contractSubscriptionData: {
      isActiveFromContract: boolean;
      endTimeFromContract: number;
      subscriptionTypeFromContract: string;
      autoRenewFromContract: boolean;
    } | null = null;

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::subscription::get_subscription_status`,
        arguments: [tx.object(SUBSCRIPTION_STORE_ID), tx.pure.address(address)],
      });

      const txResult = await client.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: address,
      });

      if (txResult.effects.status.status === 'success') {
        if (txResult.results?.[0]?.returnValues?.[0]) {
          const returnValuesFromContract = txResult.results[0]
            .returnValues[0] as unknown[];

          // Special handling for [[N],"type"] structure, similar to checkSubscription.ts
          if (
            Array.isArray(returnValuesFromContract) &&
            returnValuesFromContract.length > 0 && // Check if there's at least one element
            Array.isArray(returnValuesFromContract[0]) && // Check if the first element is an array (e.g., [1])
            returnValuesFromContract.length === 2 && // Typically this structure has two elements: [[N], "type"]
            typeof returnValuesFromContract[1] === 'string' // And the second is a string type
          ) {
            try {
              const isActiveArray = returnValuesFromContract[0] as any[];
              const parsedIsActive =
                isActiveArray &&
                isActiveArray.length > 0 &&
                isActiveArray[0] === 1;

              // Mimic script's behavior for this specific response structure
              const parsedEndTime = Math.floor(Date.now() / 1000) + 2592000; // 30 days from now
              const parsedSubscriptionType = 'standard';
              const parsedAutoRenew = false;

              console.log(
                `Parsed from nested array structure in API: isActive=${parsedIsActive}`
              );

              contractSubscriptionData = {
                isActiveFromContract: parsedIsActive,
                endTimeFromContract: parsedEndTime,
                subscriptionTypeFromContract: parsedSubscriptionType,
                autoRenewFromContract: parsedAutoRenew,
              };
            } catch (parseError) {
              console.error(
                'Failed to parse nested array structure in API:',
                parseError
              );
              // Fall through to generic parsing or let it be null if error
            }
          }

          // If not handled by special parsing or special parsing failed, try generic parsing
          if (!contractSubscriptionData) {
            let parsedIsActive = false;
            let parsedEndTime = 0;
            let parsedSubscriptionType = '';
            let parsedAutoRenew = false;

            if (
              returnValuesFromContract &&
              returnValuesFromContract.length >= 1
            ) {
              const val = returnValuesFromContract[0];
              parsedIsActive =
                val === true ||
                val === 1 ||
                String(val).toLowerCase() === 'true' ||
                String(val).toLowerCase() === '1';
            }
            if (
              returnValuesFromContract &&
              returnValuesFromContract.length >= 2
            ) {
              const timeVal = parseInt(String(returnValuesFromContract[1]), 10);
              parsedEndTime = isNaN(timeVal) ? 0 : timeVal;
            }
            if (
              returnValuesFromContract &&
              returnValuesFromContract.length >= 3
            ) {
              parsedSubscriptionType = String(returnValuesFromContract[2]);
            }
            if (
              returnValuesFromContract &&
              returnValuesFromContract.length >= 4
            ) {
              const renewVal = returnValuesFromContract[3];
              parsedAutoRenew =
                renewVal === true ||
                renewVal === 1 ||
                String(renewVal).toLowerCase() === 'true' ||
                String(renewVal).toLowerCase() === '1';
            }

            contractSubscriptionData = {
              isActiveFromContract: parsedIsActive,
              endTimeFromContract: parsedEndTime,
              subscriptionTypeFromContract: parsedSubscriptionType,
              autoRenewFromContract: parsedAutoRenew,
            };
          }
        }
      } else {
        console.warn(
          `devInspectTransactionBlock failed for ${address}:`,
          txResult.effects.status.error
        );
      }
    } catch (error: any) {
      console.error(
        `Error fetching raw subscription status for ${address} from Sui:`,
        error
      );
      // If contract call fails (e.g. subscription not found by contract),
      // contractSubscriptionData will remain null.
    }

    if (contractSubscriptionData) {
      const now = Math.floor(Date.now() / 1000); // current time in seconds

      // Determine current isActive status based on contract flag and endTime
      const currentIsActive =
        contractSubscriptionData.isActiveFromContract &&
        contractSubscriptionData.endTimeFromContract > 0 && // Ensure endTime is valid
        now <= contractSubscriptionData.endTimeFromContract;

      const apiResponse: SubscriptionStatus = {
        isActive: currentIsActive,
        endTime: formatEndTime(contractSubscriptionData.endTimeFromContract),
        subscriptionType:
          contractSubscriptionData.subscriptionTypeFromContract || null,
        autoRenew: contractSubscriptionData.autoRenewFromContract,
      };
      return res.status(200).json({
        message: 'Subscription status retrieved successfully',
        status: apiResponse,
      });
    } else {
      // No details found from contract or error during fetch, return default inactive status
      return res.status(200).json({
        // 200 with inactive status to align with previous behavior
        message: 'No subscription found or error retrieving details.',
        status: {
          isActive: false,
          endTime: null,
          subscriptionType: null,
          autoRenew: false,
        },
      });
    }
  } catch (error: any) {
    console.error('Outer error in getSubscriptionStatus API handler:', error);
    return res.status(500).json({
      message: 'Error fetching subscription status',
      error: error.message, // Provide error message for client debugging
    });
  }
}
