import React from 'react';
import {
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
} from 'react-icons/hi';
import TrainingStatus from './TrainingStatus';
import CredentialsForm from './CredentialsForm';

interface ModelOption {
  id: string;
  name: string;
  icon: React.ReactNode;
}

interface DeploymentTarget {
  id: string;
  name: string;
  provider: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  requiresAuth: boolean;
  isAuthenticated?: boolean;
}

interface TrainingStatus {
  status:
    | 'idle'
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'submitted';
  progress?: number;
  error?: string;
  result_url?: string;
  training_status_id?: string;
  started_at?: string;
  completed_at?: string;
  metrics?: {
    loss?: number;
    accuracy?: number;
    steps?: number;
    epochs?: number;
  };
}

interface TrainingDeploymentStepProps {
  trainingStatus: TrainingStatus;
  selectedModel: ModelOption;
  deployTarget: string;
  deploymentTargets: DeploymentTarget[];
  credentials: {
    [key: string]: string;
  };
  filePreview: {
    totalRows: number;
  };
  hyperparams: {
    epochs: number;
  };
  campaign: {
    campaign_id: string;
    onchain_campaign_id: string;
  };
  onStartTraining: () => void;
  onClearTrainingStatus: () => void;
  onPreviousStep: () => void;
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

const TrainingDeploymentStep: React.FC<TrainingDeploymentStepProps> = ({
  trainingStatus,
  selectedModel,
  deployTarget,
  deploymentTargets,
  credentials,
  filePreview,
  hyperparams,
  campaign,
  onStartTraining,
  onClearTrainingStatus,
  onPreviousStep,
  handleCredentialChange,
  handleSaveCredentials,
}) => {
  return (
    <>
      {/* Training Card */}
      <div className="rounded-xl p-6 border border-[#f5f5fa14]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[#f5f5faf4] text-lg font-semibold">
            Fine-Tuning
          </h3>
          <div className="flex items-center gap-2">
            <div
              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                trainingStatus.status === 'completed'
                  ? 'bg-green-500/20 text-green-500'
                  : trainingStatus.status === 'failed'
                  ? 'bg-red-500/20 text-red-500'
                  : trainingStatus.status === 'processing' ||
                    trainingStatus.status === 'pending'
                  ? 'bg-blue-500/20 text-blue-500'
                  : 'bg-[#f5f5fa14] text-[#f5f5fa7a]'
              }`}
            >
              {trainingStatus.status === 'completed' && (
                <HiOutlineCheckCircle className="w-3 h-3" />
              )}
              {trainingStatus.status === 'failed' && (
                <HiOutlineExclamationCircle className="w-3 h-3" />
              )}
              {(trainingStatus.status === 'processing' ||
                trainingStatus.status === 'pending') && (
                <div className="w-2 h-2 border-t-2 border-r-2 rounded-full animate-spin mr-1" />
              )}
              {trainingStatus.status.charAt(0).toUpperCase() +
                trainingStatus.status.slice(1)}
            </div>
            {trainingStatus.status !== 'idle' && (
              <button
                onClick={onClearTrainingStatus}
                className="text-[#f5f5fa7a] hover:text-[#f5f5faf4] text-sm"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Deployment Target Credentials */}
        {(deployTarget === 'hugging_face' ||
          deployTarget === 'vertex' ||
          deployTarget === 'sagemaker') && (
          <CredentialsForm
            deployTarget={deployTarget}
            credentials={credentials}
            handleCredentialChange={handleCredentialChange}
            handleSaveCredentials={handleSaveCredentials}
          />
        )}

        {/* Configuration Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg p-4 bg-[#f5f5fa0a]">
            <div className="text-[#f5f5fa7a] text-sm mb-1">Model</div>
            <div className="text-[#f5f5faf4] font-medium flex items-center gap-2">
              {selectedModel.icon}
              {selectedModel.name}
            </div>
          </div>
          <div className="rounded-lg p-4 bg-[#f5f5fa0a]">
            <div className="text-[#f5f5fa7a] text-sm mb-1">Training Data</div>
            <div className="text-[#f5f5faf4] font-medium">
              {filePreview.totalRows} contributions / ~ 1000 entries
            </div>
          </div>
          <div className="rounded-lg p-4 bg-[#f5f5fa0a]">
            <div className="text-[#f5f5fa7a] text-sm mb-1">Deployment</div>
            <div className="text-[#f5f5faf4] font-medium">
              {deploymentTargets.find((t) => t.id === deployTarget)?.name ||
                'Unknown'}
            </div>
          </div>
        </div>

        {/* Training Status Component */}
        <TrainingStatus
          status={trainingStatus.status}
          progress={trainingStatus.progress}
          error={trainingStatus.error}
          result_url={trainingStatus.result_url}
          training_status_id={trainingStatus.training_status_id}
          started_at={trainingStatus.started_at}
          completed_at={trainingStatus.completed_at}
          metrics={trainingStatus.metrics}
          onStartTraining={onStartTraining}
          onClearTrainingStatus={onClearTrainingStatus}
          hyperparams={hyperparams}
          campaign={campaign}
        />

        {/* Navigation */}
        <div className="flex justify-between pt-6 mt-6 border-t border-[#f5f5fa14]">
          <button
            onClick={onPreviousStep}
            className="px-6 py-2 rounded-lg border border-[#f5f5fa14] text-[#f5f5faf4] font-medium hover:bg-[#f5f5fa0a]"
          >
            Back
          </button>
        </div>
      </div>
    </>
  );
};

export default TrainingDeploymentStep;
