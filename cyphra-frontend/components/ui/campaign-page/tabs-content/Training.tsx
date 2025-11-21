import React, { useState, useEffect, useRef } from 'react';
import {
  HiOutlineChip,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineCloudUpload,
  HiOutlineDatabase,
  HiOutlineCode,
  HiOutlineSparkles,
  HiOutlineLightningBolt,
} from 'react-icons/hi';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useCurrentAccount } from '@mysten/dapp-kit';
import {
  ProcessDataStep,
  ModelSelectionStep,
  ConfigurationStep,
  TrainingDeploymentStep,
  StepIndicator,
} from './training-components';

const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;

interface ColumnInfo {
  name: string;
  type: 'numeric' | 'categorical' | 'text' | 'date' | 'boolean';
  description?: string;
  missing_values?: number;
  unique_values?: number;
  sample_values?: string[];
}

interface ModelOption {
  id: string;
  name: string;
  description: string;
  parameters: string;
  requirements: string;
  trainingTime: string;
  bestFor: string[];
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

interface TrainingHyperparams {
  epochs: number;
  batchSize: number;
  learningRate: number;
  useAdvancedOptions: boolean;
  warmupSteps: number;
  weightDecay: number;
}

interface TrainingProps {
  campaign: {
    campaign_id: string;
    onchain_campaign_id: string;
    title: string;
    data_requirements: string;
    current_contributions: number;
  };
  isLoading?: boolean;
}

const DEFAULT_HYPERPARAMS: TrainingHyperparams = {
  epochs: 3,
  batchSize: 8,
  learningRate: 0.00005,
  useAdvancedOptions: false,
  warmupSteps: 100,
  weightDecay: 0.01,
};

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'eleuther-pythia-70m',
    name: 'EleutherAI/pythia-70m-deduped',
    description:
      'A 70M parameter model from the Pythia suite, trained on the Pile (deduplicated). Primarily for research on LLM behavior, interpretability, and limitations. Not intended for direct deployment without fine-tuning.',
    parameters: '70 Million',
    requirements: 'Medium',
    trainingTime: '30-45 min',
    bestFor: [
      'LLM Research',
      'Interpretability Studies',
      'Base for Fine-tuning',
    ],
    icon: <HiOutlineSparkles className="w-6 h-6 text-blue-400" />,
  },
  {
    id: 'eleutherai/gpt-neo-125m',
    name: 'EleutherAI/gpt-neo-125m',
    description:
      'A 125M parameter transformer model, replicating GPT-3 architecture. Trained on the Pile. Good for text generation and as a base for fine-tuning on various NLP tasks.',
    parameters: '125 Million',
    requirements: 'High',
    trainingTime: '1-2 hours',
    bestFor: ['Text Generation', 'Feature Extraction', 'Base for Fine-tuning'],
    icon: <HiOutlineLightningBolt className="w-6 h-6 text-purple-400" />,
  },
  {
    id: 'qwen/qwen2-7b',
    name: 'Qwen/Qwen2-7B',
    description:
      'A 7B parameter model from the Qwen2 series. Strong multilingual capabilities, coding, mathematics, and reasoning. Suitable for a wide range of downstream tasks after fine-tuning.',
    parameters: '7.6 Billion',
    requirements: 'High',
    trainingTime: '2-4 hours',
    bestFor: [
      'Multilingual Tasks',
      'Coding Assistance',
      'Mathematical Reasoning',
      'General Purpose LLM',
    ],
    icon: <HiOutlineDatabase className="w-6 h-6 text-green-400" />,
  },
];

const DEPLOYMENT_TARGETS: DeploymentTarget[] = [
  {
    id: 'hugging_face',
    name: 'Hugging Face',
    provider: 'Hugging Face',
    description:
      'Deploy to Hugging Face Hub for easy sharing, versioning, and collaborative model development.',
    icon: <HiOutlineCode className="w-6 h-6" />,
    color: 'from-yellow-500 to-red-500',
    requiresAuth: true,
  },
  {
    id: 'vertex',
    name: 'Vertex AI',
    provider: 'Google Cloud',
    description:
      'Deploy to Google Vertex AI for production-grade scaling, monitoring, and enterprise features.',
    icon: <HiOutlineCloudUpload className="w-6 h-6" />,
    color: 'from-blue-500 to-green-500',
    requiresAuth: true,
  },
  {
    id: 'sagemaker',
    name: 'SageMaker',
    provider: 'AWS',
    description:
      'Deploy to AWS SageMaker for robust, scalable, and fully managed machine learning infrastructure.',
    icon: <HiOutlineChip className="w-6 h-6" />,
    color: 'from-orange-500 to-yellow-500',
    requiresAuth: true,
  },
  // {
  //   id: 'api',
  //   name: 'Hyvve API',
  //   provider: 'Hyvve',
  //   description:
  //     'Deploy to Hyvve managed infrastructure for instant integration with your existing campaigns.',
  //   icon: <HiOutlineStatusOnline className="w-6 h-6" />,
  //   color: 'from-purple-500 to-indigo-500',
  //   requiresAuth: false,
  //   isAuthenticated: true,
  // },
];

const STEPS = [
  { step: 1, label: 'Process Data' },
  { step: 2, label: 'Select Model' },
  { step: 3, label: 'Configure' },
  { step: 4, label: 'Train & Deploy' },
];

const Training: React.FC<TrainingProps> = ({ campaign, isLoading }) => {
  // State for model selection and training
  const [selectedModelId, setSelectedModelId] = useState<string>(
    'eleuther-pythia-70m'
  );
  const [hyperparams, setHyperparams] =
    useState<TrainingHyperparams>(DEFAULT_HYPERPARAMS);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus>({
    status: 'idle',
  });
  const [deployTarget, setDeployTarget] = useState<string>('hugging_face');
  const [filePreview, setFilePreview] = useState<{
    totalRows: number;
    sampleData: string[];
    columns: string[];
  }>({
    totalRows: campaign.current_contributions || 0,
    sampleData: [
      'The product exceeded my expectations. Highly recommended!',
      'Customer service was excellent, but delivery was slow.',
      'Not what I expected. The quality could be better.',
      'Perfect fit for my needs. Will purchase again.',
    ],
    columns: ['text', 'label', 'created_at', 'id'],
  });

  // State for processing data
  const [isProcessingData, setIsProcessingData] = useState<boolean>(false);
  const [processedDataId, setProcessedDataId] = useState<string | null>(null);
  const [dataProcessingResponse, setDataProcessingResponse] =
    useState<any>(null);
  const [dataProcessingError, setDataProcessingError] = useState<string | null>(
    null
  );

  // State for platform credentials
  const [credentials, setCredentials] = useState<{
    hugging_face: string;
    vertex: string;
    sagemaker: string;
    sagemaker_secret?: string;
    secret_key?: string;
    hf_username?: string;
    project_id?: string;
  }>({
    hugging_face: '',
    vertex: '',
    sagemaker: '',
    sagemaker_secret: '',
    secret_key: '',
    hf_username: '',
    project_id: '',
  });

  const [savedHfUsername, setSavedHfUsername] = useState<string>('');
  const [savedCredentialId, setSavedCredentialId] = useState<string | null>(
    null
  );

  // Get the current wallet account
  const account = useCurrentAccount();

  // Storage key for persisting state
  const storageKey = `training_state_${campaign.onchain_campaign_id}`;

  // Ref to store the polling interval ID for proper cleanup
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Clear any existing polling interval
  const clearPollingInterval = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // Forward declaration for polling function
  const pollTrainingStatus = React.useCallback(
    (trainingJobId: string) => {
      // Clear any existing interval before starting a new one
      clearPollingInterval();

      console.log(`Starting polling for training job: ${trainingJobId}`);

      pollingIntervalRef.current = setInterval(async () => {
        // Check if component is still mounted
        if (!isMountedRef.current) {
          clearPollingInterval();
          return;
        }

        try {
          console.log(`Polling training status for job: ${trainingJobId}`);

          // Make API call to get training status using new endpoint
          const response = await axios.get(
            `${baseUrl}/mlops/training-jobs/${trainingJobId}`
          );
          const statusData = response.data;

          console.log('Training status response:', statusData);

          // Check if component is still mounted before updating state
          if (!isMountedRef.current) {
            clearPollingInterval();
            return;
          }

          // Update training status based on API response
          setTrainingStatus((prevStatus) => {
            // If we're already completed or failed, stop polling
            if (
              prevStatus.status === 'completed' ||
              prevStatus.status === 'failed'
            ) {
              clearPollingInterval();
              return prevStatus;
            }

            // Map API status to our status
            let newStatus = statusData.status;
            if (newStatus === 'completed') newStatus = 'completed';
            else if (newStatus === 'failed') newStatus = 'failed';
            else if (newStatus === 'running' || newStatus === 'in_progress')
              newStatus = 'processing';
            else if (newStatus === 'pending') newStatus = 'pending';

            // Calculate progress based on status
            let newProgress = prevStatus.progress || 0;
            if (newStatus === 'submitted') newProgress = 20;
            else if (newStatus === 'pending') newProgress = 5;
            else if (newStatus === 'processing')
              newProgress = Math.min(
                90,
                Math.max(25, (prevStatus.progress || 25) + 5)
              );
            else if (newStatus === 'completed') newProgress = 100;

            // If training is complete, update status and stop polling
            if (newStatus === 'completed') {
              clearPollingInterval();
              console.log('Training completed, stopping polling');

              // Clear localStorage after a delay to let user see the completed state
              setTimeout(() => {
                if (isMountedRef.current) {
                  localStorage.removeItem(storageKey);
                }
              }, 30000); // Clear after 30 seconds

              return {
                status: 'completed',
                progress: 100,
                result_url:
                  statusData.huggingface_model_url ||
                  statusData.output_model_url,
                training_status_id: trainingJobId,
                started_at: statusData.started_at || prevStatus.started_at,
                completed_at: statusData.completed_at,
                metrics: statusData.metrics || prevStatus.metrics,
              };
            }

            // If training failed, update status and stop polling
            if (newStatus === 'failed') {
              clearPollingInterval();
              console.log('Training failed, stopping polling');

              return {
                status: 'failed',
                error: statusData.error_message || 'Training process failed',
                training_status_id: trainingJobId,
                started_at: statusData.started_at || prevStatus.started_at,
                completed_at: statusData.completed_at,
              };
            }

            // Otherwise, update with latest data
            console.log(
              `Training status: ${newStatus}, progress: ${newProgress}%`
            );

            return {
              ...prevStatus,
              status: newStatus,
              progress: newProgress,
              started_at: statusData.started_at || prevStatus.started_at,
              metrics: statusData.metrics || prevStatus.metrics,
              error: statusData.error_message,
              result_url:
                statusData.huggingface_model_url || statusData.output_model_url,
            };
          });
        } catch (error) {
          console.error('Error polling training status:', error);

          // If we get a 404 or the job doesn't exist, stop polling
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            console.log('Training job not found, stopping polling');
            clearPollingInterval();

            if (isMountedRef.current) {
              setTrainingStatus((prev) => ({
                ...prev,
                status: 'failed',
                error: 'Training job not found',
              }));
            }
          }
          // For other errors, continue polling but log the error
        }
      }, 30 * 1000); // Poll every 30 seconds (reduced from 1 minute for better UX)

      // Return the interval ID for external cleanup if needed
      return pollingIntervalRef.current;
    },
    [storageKey, baseUrl]
  );

  // Cleanup function to stop polling and mark component as unmounted
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearPollingInterval();
    };
  }, []);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem(storageKey);
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);

        // Restore state
        if (parsedState.selectedModelId)
          setSelectedModelId(parsedState.selectedModelId);
        if (parsedState.hyperparams) setHyperparams(parsedState.hyperparams);
        if (parsedState.activeStep) setActiveStep(parsedState.activeStep);
        if (parsedState.deployTarget) setDeployTarget(parsedState.deployTarget);
        if (parsedState.processedDataId)
          setProcessedDataId(parsedState.processedDataId);
        if (parsedState.savedHfUsername)
          setSavedHfUsername(parsedState.savedHfUsername);
        if (parsedState.savedCredentialId)
          setSavedCredentialId(parsedState.savedCredentialId);
        if (parsedState.credentials) setCredentials(parsedState.credentials);
        if (parsedState.dataProcessingResponse)
          setDataProcessingResponse(parsedState.dataProcessingResponse);

        if (parsedState.trainingStatus) {
          setTrainingStatus(parsedState.trainingStatus);

          // Only resume polling if the training is still in progress
          if (
            (parsedState.trainingStatus.status === 'submitted' ||
              parsedState.trainingStatus.status === 'pending' ||
              parsedState.trainingStatus.status === 'processing') &&
            parsedState.trainingStatus.training_status_id
          ) {
            console.log(
              'Resuming training poll for job:',
              parsedState.trainingStatus.training_status_id
            );
            // Add a small delay before starting polling to ensure component is fully mounted
            setTimeout(() => {
              if (isMountedRef.current) {
                pollTrainingStatus(
                  parsedState.trainingStatus.training_status_id
                );
              }
            }, 1000);
          }
        }
      } catch (error) {
        console.error('Error loading saved training state:', error);
        localStorage.removeItem(storageKey);
      }
    }
  }, [campaign.onchain_campaign_id, pollTrainingStatus]);

  // Save state to localStorage whenever relevant state changes
  useEffect(() => {
    const stateToSave = {
      selectedModelId,
      hyperparams,
      activeStep,
      trainingStatus,
      deployTarget,
      processedDataId,
      savedHfUsername,
      savedCredentialId,
      credentials,
      dataProcessingResponse,
      timestamp: Date.now(),
    };

    // Only save if we have meaningful state (not just initial state)
    if (
      processedDataId ||
      savedCredentialId ||
      trainingStatus.status !== 'idle' ||
      activeStep > 1
    ) {
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    }
  }, [
    selectedModelId,
    hyperparams,
    activeStep,
    trainingStatus,
    deployTarget,
    processedDataId,
    savedHfUsername,
    savedCredentialId,
    credentials,
    dataProcessingResponse,
    storageKey,
  ]);

  // Compute the selected model
  const selectedModel =
    MODEL_OPTIONS.find((model) => model.id === selectedModelId) ||
    MODEL_OPTIONS[0];

  // Update hyperparameter value
  const updateHyperparam = (param: keyof TrainingHyperparams, value: any) => {
    setHyperparams((prev) => ({
      ...prev,
      [param]: value,
    }));
  };

  // Format number for display
  const formatNumber = (num: number): string => {
    if (num < 0.0001) return num.toExponential(2);
    return num.toString();
  };

  // Handle navigating through steps
  const handleNextStep = () => {
    if (activeStep < 4) {
      // Check if user is on model selection step (step 2) and selected a large model
      if (
        activeStep === 2 &&
        (selectedModelId === 'eleutherai/gpt-neo-125m' ||
          selectedModelId === 'qwen/qwen2-7b')
      ) {
        // Show toast notification with beautiful styling
        toast.error(
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-500/20 flex-shrink-0">
              <HiOutlineExclamationCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                Insufficient Training Data
              </p>
              <p className="text-xs text-neutral-300">
                Please use the 70M parameter model for this campaign's dataset
                size.
              </p>
            </div>
          </div>,
          {
            position: 'top-center',
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: 'dark',
            className: 'bg-[#202027] border border-[#303040] shadow-xl',
            bodyClassName: 'p-0',
          }
        );
        // Don't proceed to next step
        return;
      }

      // If using the appropriate model or on a different step, proceed
      setActiveStep(activeStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (activeStep > 1) {
      setActiveStep(activeStep - 1);
    }
  };

  // Process data function
  const handleProcessData = async () => {
    try {
      setIsProcessingData(true);
      setDataProcessingError(null);

      // Make actual API call to /mlops/datasets
      const response = await axios.post(`${baseUrl}/mlops/datasets`, {
        creator_wallet_address: account?.address,
        onchain_campaign_id: campaign.onchain_campaign_id,
      });

      // Store the API response
      setDataProcessingResponse(response.data);

      console.log('dataset id', response.data.id);

      // Get dataset ID from API response
      const datasetId = response.data.id;

      setProcessedDataId(datasetId);
      setIsProcessingData(false);

      // Show success toast
      toast.success(
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-green-500/20 flex-shrink-0">
            <HiOutlineCheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="font-semibold text-sm">Data Processed Successfully</p>
            <p className="text-xs text-neutral-300">
              Your campaign data is ready for model training.
            </p>
          </div>
        </div>,
        {
          position: 'top-center',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          theme: 'dark',
          className: 'bg-[#202027] border border-[#303040] shadow-xl',
          bodyClassName: 'p-0',
        }
      );
    } catch (error) {
      console.error('Error processing data:', error);
      setIsProcessingData(false);

      // Store the error
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      setDataProcessingError(errorMessage);

      // Show error toast
      toast.error(
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-red-500/20 flex-shrink-0">
            <HiOutlineExclamationCircle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-sm">Data Processing Failed</p>
            <p className="text-xs text-neutral-300">
              {error instanceof Error
                ? error.message
                : 'Please try again or contact support.'}
            </p>
          </div>
        </div>,
        {
          position: 'top-center',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          theme: 'dark',
          className: 'bg-[#202027] border border-[#303040] shadow-xl',
          bodyClassName: 'p-0',
        }
      );
    }
  };

  // Handle credential change
  const handleCredentialChange = (
    platform: string,
    field: string,
    value: string
  ) => {
    setCredentials((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Save credentials
  const handleSaveCredentials = async (
    platform: string,
    credentialName: string,
    additionalConfig?: any
  ) => {
    try {
      // Generate a unique credential name if not provided
      const uniqueCredentialName =
        credentialName ||
        `${platform}_${Date.now().toString(36)}${Math.random()
          .toString(36)
          .substring(2, 7)}`;

      // Make actual API call to save credentials
      const response = await axios.post(`${baseUrl}/mlops/user-credentials`, {
        user_wallet_address: account?.address,
        platform: platform,
        credential_name: uniqueCredentialName,
        additional_config: additionalConfig,
        api_key: null,
        secret_key: credentials.secret_key,
      });

      console.log('credential id', response.data);

      // Store the credential ID from the API response
      if (response.data.id) {
        setSavedCredentialId(response.data.id);
      }

      if (platform === 'hugging_face' && credentials.hf_username) {
        setSavedHfUsername(credentials.hf_username);
      }

      // Update local state to mark the platform as authenticated
      const updatedDeploymentTargets = DEPLOYMENT_TARGETS.map((target) =>
        target.id === platform ? { ...target, isAuthenticated: true } : target
      );

      // Show success toast
      toast.success(
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-green-500/20 flex-shrink-0">
            <HiOutlineCheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="font-semibold text-sm">Credentials Saved</p>
            <p className="text-xs text-neutral-300">
              Your {platform} API credentials have been securely stored.
            </p>
          </div>
        </div>,
        {
          position: 'top-center',
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          theme: 'dark',
          className: 'bg-[#202027] border border-[#303040] shadow-xl',
          bodyClassName: 'p-0',
        }
      );
    } catch (error) {
      console.error('Error saving credentials:', error);

      // Show error toast
      toast.error(
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-red-500/20 flex-shrink-0">
            <HiOutlineExclamationCircle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-sm">Failed to Save Credentials</p>
            <p className="text-xs text-neutral-300">
              {error instanceof Error
                ? error.message
                : 'Please check your API key and try again.'}
            </p>
          </div>
        </div>,
        {
          position: 'top-center',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          theme: 'dark',
          className: 'bg-[#202027] border border-[#303040] shadow-xl',
          bodyClassName: 'p-0',
        }
      );
    }
  };

  // Handle start training click
  const handleStartTraining = async () => {
    try {
      // Validate required data
      if (!processedDataId) {
        toast.error('Please process your data first before starting training.');
        return;
      }

      if (
        deployTarget === 'hugging_face' &&
        (!savedCredentialId || !savedHfUsername)
      ) {
        toast.error('Please save your Hugging Face credentials first.');
        return;
      }

      setTrainingStatus({ status: 'pending', progress: 5 });

      // Generate job name
      const jobName = `${
        selectedModel.name.split('/')[1] || selectedModel.name
      } HF-${Date.now().toString(36)}`;

      // Prepare request payload for new endpoint
      const trainingPayload = {
        job_name: jobName,
        user_wallet_address: account?.address,
        processed_dataset_id: processedDataId,
        platform: deployTarget,
        user_credential_id: savedCredentialId,
        model_type: 'CAUSAL_LM',
        hyperparameters: {
          base_model_id: 'EleutherAI/pythia-70m-deduped',
          model_task_type: 'CAUSAL_LM',
          epochs: 1,
          learning_rate: 0.0002,
          batch_size: 2,
          gradient_accumulation_steps: 4,
          max_seq_length: 512,
          text_column: 'text',
          load_in_4bit: true,
          bnb_4bit_compute_dtype: 'bfloat16',
          bnb_4bit_quant_type: 'nf4',
          bnb_4bit_use_double_quant: true,
          lora_r: 16,
          lora_alpha: 32,
          lora_dropout: 0.05,
          optim: 'paged_adamw_8bit',
        },
        training_script_config: {
          hf_username: savedHfUsername,
          hf_target_model_repo_id: `${savedHfUsername}/pythia-70m-${Date.now().toString(
            36
          )}`,
          hf_space_hardware: 't4-small',
          hf_private_repos: false,
          model_output_dir_in_space: '/outputs',
          report_to: 'tensorboard',
          logging_steps: 10,
        },
      };

      console.log(trainingPayload);

      // Make API call to start training with new endpoint
      const response = await axios.post(
        `${baseUrl}/mlops/training-jobs`,
        trainingPayload
      );

      // Get training job ID from response
      const trainingJobId = response.data.id;

      // Update training status with initial data from API
      setTrainingStatus({
        status: response.data.status === 'pending' ? 'pending' : 'processing',
        progress: 5,
        training_status_id: trainingJobId,
        started_at: response.data.started_at || new Date().toISOString(),
        result_url: response.data.huggingface_model_url,
        error: response.data.error_message,
        metrics: response.data.metrics || {
          loss: 0.5,
          accuracy: 0.8,
          steps: 0,
          epochs: 0,
        },
      });

      // Start polling for training status updates
      pollTrainingStatus(trainingJobId);
    } catch (error) {
      console.error('Error starting training:', error);
      setTrainingStatus({
        status: 'failed',
        error:
          error instanceof Error ? error.message : 'Failed to start training',
      });

      toast.error(
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-red-500/20 flex-shrink-0">
            <HiOutlineExclamationCircle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-sm">Training Failed</p>
            <p className="text-xs text-neutral-300">
              {error instanceof Error
                ? error.message
                : 'Failed to start training. Please try again.'}
            </p>
          </div>
        </div>,
        {
          position: 'top-center',
          theme: 'dark',
          className: 'bg-[#202027] border border-[#303040] shadow-xl',
        }
      );
    }
  };

  // Clear training status
  const handleClearTrainingStatus = () => {
    // Clear any active polling
    clearPollingInterval();

    // Clear the localStorage
    localStorage.removeItem(storageKey);

    // Reset training status
    setTrainingStatus({ status: 'idle' });
    setActiveStep(1);

    // Optionally reset other state
    setProcessedDataId(null);
    setSavedCredentialId(null);
    setSavedHfUsername('');
    setCredentials({
      hugging_face: '',
      vertex: '',
      sagemaker: '',
      sagemaker_secret: '',
      secret_key: '',
      hf_username: '',
      project_id: '',
    });

    console.log('Training status cleared and polling stopped');
  };

  // Return loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6 py-6 pr-6 animate-pulse">
        <div className="h-12 w-64 bg-[#f5f5fa14] rounded mb-8"></div>
        <div className="grid grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[#f5f5fa14] p-6 h-40"
            ></div>
          ))}
        </div>
        <div className="rounded-xl border border-[#f5f5fa14] p-6 h-80"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 pr-6">
      {/* Step Indicator */}
      <StepIndicator steps={STEPS} activeStep={activeStep} />

      {/* Step 1: Process Data */}
      {activeStep === 1 && (
        <ProcessDataStep
          campaign={campaign}
          filePreview={filePreview}
          processedDataId={processedDataId}
          isProcessingData={isProcessingData}
          onProcessData={handleProcessData}
          onNextStep={handleNextStep}
          apiResponse={dataProcessingResponse}
          apiError={dataProcessingError}
        />
      )}

      {/* Step 2: Model Selection */}
      {activeStep === 2 && (
        <ModelSelectionStep
          campaign={campaign}
          modelOptions={MODEL_OPTIONS}
          selectedModelId={selectedModelId}
          onSelectModel={setSelectedModelId}
          onNextStep={handleNextStep}
        />
      )}

      {/* Step 3: Configuration */}
      {activeStep === 3 && (
        <ConfigurationStep
          filePreview={filePreview}
          selectedModel={selectedModel}
          hyperparams={hyperparams}
          updateHyperparam={updateHyperparam}
          deployTarget={deployTarget}
          deploymentTargets={DEPLOYMENT_TARGETS}
          setDeployTarget={setDeployTarget}
          onNextStep={handleNextStep}
          onPreviousStep={handlePreviousStep}
          formatNumber={formatNumber}
        />
      )}

      {/* Step 4: Training & Deployment */}
      {activeStep === 4 && (
        <TrainingDeploymentStep
          trainingStatus={trainingStatus}
          selectedModel={selectedModel}
          deployTarget={deployTarget}
          deploymentTargets={DEPLOYMENT_TARGETS}
          credentials={credentials}
          filePreview={filePreview}
          hyperparams={hyperparams}
          campaign={campaign}
          onStartTraining={handleStartTraining}
          onClearTrainingStatus={handleClearTrainingStatus}
          onPreviousStep={handlePreviousStep}
          handleCredentialChange={handleCredentialChange}
          handleSaveCredentials={handleSaveCredentials}
        />
      )}
    </div>
  );
};

export default Training;
