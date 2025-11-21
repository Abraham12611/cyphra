import { NextApiRequest, NextApiResponse } from 'next';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';

function parseU64(bytes: number[]): bigint {
  return BigInt(bcs.u64().parse(Uint8Array.from(bytes)));
}

function formatSui(amount: bigint): string {
  return (Number(amount) / 1_000_000_000).toFixed(9);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { campaignId } = req.query;

  if (!campaignId || typeof campaignId !== 'string') {
    return res.status(400).json({ message: 'Campaign ID is required' });
  }

  try {
    // Configuration - Using the same env var names as the script
    const PACKAGE_ID = process.env.NEXT_PUBLIC_CAMPAIGN_MANAGER_PACKAGE_ID;

    const CAMPAIGN_STORE_ID = process.env.NEXT_PUBLIC_CAMPAIGN_STORE_ID || '';
    const ESCROW_STORE_ID = process.env.NEXT_PUBLIC_ESCROW_STORE_ID || '';

    // Log configuration for debugging
    console.log('Configuration:', {
      PACKAGE_ID,
      CAMPAIGN_STORE_ID,
      ESCROW_STORE_ID,
      campaignId,
    });

    if (!PACKAGE_ID || !ESCROW_STORE_ID) {
      return res.status(500).json({
        message: 'Missing environment variables',
        missingVars: {
          PACKAGE_ID: !PACKAGE_ID,
          ESCROW_STORE_ID: !ESCROW_STORE_ID,
        },
      });
    }

    // Network configuration
    const networkMap = {
      testnet: 'testnet',
      mainnet: 'mainnet',
      devnet: 'devnet',
      localnet: 'localnet',
    } as const;

    const networkInput =
      process.env.NETWORK || process.env.NEXT_PUBLIC_NETWORK || 'testnet';
    const network =
      networkMap[networkInput as keyof typeof networkMap] || 'testnet';
    const rpcUrl = getFullnodeUrl(network);

    console.log('Network configuration:', { network, rpcUrl });

    const client = new SuiClient({ url: rpcUrl });

    // First check if campaign exists in the campaign store
    if (CAMPAIGN_STORE_ID) {
      try {
        const campaignDetailsTx = new Transaction();
        const campaignDetailsTarget =
          `${PACKAGE_ID}::campaign::get_campaign_details` as `${string}::${string}::${string}`;

        campaignDetailsTx.moveCall({
          target: campaignDetailsTarget,
          arguments: [
            campaignDetailsTx.object(CAMPAIGN_STORE_ID),
            campaignDetailsTx.pure.string(campaignId),
          ],
        });

        console.log('Checking if campaign exists...');
        const campaignDetailsResult = await client.devInspectTransactionBlock({
          transactionBlock: campaignDetailsTx,
          sender:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
        });

        if (campaignDetailsResult.effects.status.status !== 'success') {
          console.warn(
            'Campaign not found in store:',
            campaignDetailsResult.effects.status.error
          );
        }
      } catch (err) {
        console.warn('Error checking campaign existence:', err);
        // Continue anyway to check escrow
      }
    }

    // Get escrow balance
    const balanceTx = new Transaction();
    const balanceTarget =
      `${PACKAGE_ID}::escrow::get_available_balance` as `${string}::${string}::${string}`;

    console.log('Preparing escrow balance transaction:', {
      target: balanceTarget,
      escrowStoreId: ESCROW_STORE_ID,
      campaignId,
    });

    balanceTx.moveCall({
      target: balanceTarget,
      arguments: [
        balanceTx.object(ESCROW_STORE_ID),
        balanceTx.pure.string(campaignId),
      ],
      typeArguments: ['0x2::sui::SUI'],
    });

    const balanceResult = await client.devInspectTransactionBlock({
      transactionBlock: balanceTx,
      sender:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
    });

    console.log('Balance result status:', balanceResult.effects.status);

    if (balanceResult.effects.status.status !== 'success') {
      return res.status(500).json({
        message: 'Error fetching campaign escrow balance',
        error: balanceResult.effects.status.error,
        details: balanceResult.effects,
      });
    }

    if (
      balanceResult.results &&
      balanceResult.results.length > 0 &&
      balanceResult.results[0].returnValues
    ) {
      const remainingBalanceBytes = balanceResult.results[0]
        .returnValues[0][0] as number[];
      const remainingBalance = parseU64(remainingBalanceBytes);

      console.log('Remaining balance found:', {
        mist: remainingBalance.toString(),
        sui: formatSui(remainingBalance),
      });

      return res.status(200).json({
        remainingBudgetMist: remainingBalance.toString(),
        remainingBudgetSui: formatSui(remainingBalance),
      });
    } else {
      console.log('No budget information in result:', balanceResult);
      return res.status(404).json({
        message: 'No budget information found',
        rawResponse: balanceResult,
      });
    }
  } catch (error: any) {
    console.error('Error fetching campaign budget:', error);

    return res.status(500).json({
      message: 'Error fetching campaign budget',
      details: error.message,
      stack: error.stack,
    });
  }
}
