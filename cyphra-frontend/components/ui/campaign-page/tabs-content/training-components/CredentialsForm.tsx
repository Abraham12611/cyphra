import React, { useMemo } from 'react';
import { HiOutlineExclamationCircle, HiOutlineSave } from 'react-icons/hi';
import { useCurrentAccount } from '@mysten/dapp-kit';

interface CredentialsFormProps {
  deployTarget: string;
  credentials: {
    [key: string]: string;
  };
  handleCredentialChange: (
    platform: string,
    field: string,
    value: string
  ) => void;
  handleSaveCredentials: (
    platform: string,
    credentialName: string,
    additionalConfig?: any
  ) => void;
}

const CredentialsForm: React.FC<CredentialsFormProps> = ({
  deployTarget,
  credentials,
  handleCredentialChange,
  handleSaveCredentials,
}) => {
  const account = useCurrentAccount();

  // Generate unique credential name based on platform and timestamp
  const credentialName = useMemo(() => {
    const timestamp = Date.now();
    const shortAddress = account?.address
      ? account.address.substring(0, 8)
      : 'unknown';
    return `${deployTarget}_${shortAddress}_${timestamp}`;
  }, [deployTarget, account?.address]);

  return (
    <div className="mb-6 rounded-lg p-4 border border-[#f5f5fa14] bg-[#f5f5fa05]">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-full bg-amber-500/20 flex-shrink-0">
          <HiOutlineExclamationCircle className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h4 className="text-[#f5f5faf4] font-medium mb-1">
            API Credentials Required
          </h4>
          <p className="text-[#f5f5fa7a] text-sm">
            {deployTarget === 'hugging_face' &&
              'To deploy to Hugging Face, please provide your username and API key.'}
            {deployTarget === 'vertex' &&
              'To deploy to Google Vertex AI, please provide your API credentials.'}
            {deployTarget === 'sagemaker' &&
              'To deploy to AWS SageMaker, please provide your AWS credentials.'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {deployTarget === 'hugging_face' && (
          <div>
            <label className="text-[#f5f5fa7a] text-sm block mb-1">
              Hugging Face Username
            </label>
            <input
              type="text"
              value={credentials['hf_username'] || ''}
              onChange={(e) =>
                handleCredentialChange(
                  deployTarget,
                  'hf_username',
                  e.target.value
                )
              }
              placeholder="Enter your Hugging Face username"
              className="w-full bg-[#0a0a0f] border border-[#f5f5fa1a] rounded-lg px-4 py-2 text-[#f5f5faf4] placeholder-[#f5f5fa4a] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
            />
          </div>
        )}

        <div>
          <label className="text-[#f5f5fa7a] text-sm block mb-1">
            {deployTarget === 'hugging_face' &&
              'Hugging Face API Token (Secret)'}
            {deployTarget === 'vertex' && 'Google Cloud API Key'}
            {deployTarget === 'sagemaker' && 'AWS Access Key ID'}
          </label>
          <input
            type="password"
            value={
              credentials[
                deployTarget === 'hugging_face' ? 'secret_key' : deployTarget
              ] || ''
            }
            onChange={(e) =>
              handleCredentialChange(
                deployTarget,
                deployTarget === 'hugging_face' ? 'secret_key' : deployTarget,
                e.target.value
              )
            }
            placeholder="Enter your API key"
            className="w-full bg-[#0a0a0f] border border-[#f5f5fa1a] rounded-lg px-4 py-2 text-[#f5f5faf4] placeholder-[#f5f5fa4a] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
          />
        </div>

        {(deployTarget === 'vertex' || deployTarget === 'sagemaker') && (
          <div>
            <label className="text-[#f5f5fa7a] text-sm block mb-1">
              {deployTarget === 'vertex' && 'Project ID'}
              {deployTarget === 'sagemaker' && 'AWS Secret Access Key'}
            </label>
            <input
              type="password"
              value={
                credentials[
                  deployTarget === 'sagemaker' ? 'secret_key' : 'project_id'
                ] || ''
              }
              onChange={(e) =>
                handleCredentialChange(
                  deployTarget,
                  deployTarget === 'sagemaker' ? 'secret_key' : 'project_id',
                  e.target.value
                )
              }
              placeholder={
                deployTarget === 'vertex'
                  ? 'Enter your Project ID'
                  : 'Enter your Secret Key'
              }
              className="w-full bg-[#0a0a0f] border border-[#f5f5fa1a] rounded-lg px-4 py-2 text-[#f5f5faf4] placeholder-[#f5f5fa4a] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
            />
          </div>
        )}

        <div className="bg-[#0a0a0f] rounded p-3 text-[#f5f5fa7a] text-xs font-mono">
          POST /mlops/user-credentials
          <br />
          {`{`}
          <br />
          {`  "user_wallet_address": "${account?.address}",`}
          <br />
          {`  "platform": "${deployTarget}",`}
          <br />
          {`  "credential_name": "${credentialName}",`}
          <br />
          {deployTarget === 'hugging_face' &&
            `  "additional_config": { "hf_username": "********" },`}
          <br />
          {`  "api_key": null,`}
          <br />
          {`  "secret_key": "********"`}
          <br />
          {`}`}
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => {
              const additionalConfig =
                deployTarget === 'hugging_face'
                  ? { hf_username: credentials['hf_username'] || '' }
                  : undefined;

              handleSaveCredentials(
                deployTarget,
                credentialName,
                additionalConfig
              );
            }}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white text-sm font-medium flex items-center gap-2 hover:opacity-90"
          >
            <HiOutlineSave className="w-4 h-4" />
            Save Credentials
          </button>
        </div>
      </div>
    </div>
  );
};

export default CredentialsForm;
