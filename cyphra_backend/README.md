# Hyvve: AI-Powered Data Collection and Workflow Platform

### 1. Overview

Hyvve is a token-incentivized data marketplace that connects AI researchers, companies, and everyday data contributors. On Hyvve, users can buy AI-ready data, sell their own for token rewards, or leverage the platform's advanced AI capabilities for data processing, verification, and AI model training. All interactions occur on a secure, decentralized platform.

The backend services are the powerhouse of Hyvve, managing data collection campaigns, user contributions, in-depth analytics, and a sophisticated **AI Agent and Workflow Engine**. This engine, leveraging LLMs from providers like **Atoma**, enables dynamic, configurable AI-driven processes, including automated data verification, custom data transformations, and support for AI model training workflows with data storage on **Walrus**.

Critically, the Hyvve backend acts as an intelligent mirror for onchain data. This design significantly enhances performance and enables complex analytical computations and AI processes that would be prohibitively expensive if executed solely via direct blockchain RPCs. Despite these backend optimizations, the **Movement chain** (or specified blockchain like Sui) remains the ultimate single source of truth for all onchain transactions and data ownership.

### 2. Key Features

Hyvve offers a comprehensive suite of features for data collection, AI processing, and analytics:

* **Campaign Management:**
  * Define and manage data collection initiatives (campaigns) with specific parameters: title, description, data requirements, budget, etc.
  * Track user contributions (text, documents, images, etc.) to these campaigns.
* **Advanced AI-Powered Data Verification:**
  * Automated verification of contributed data for accuracy and relevance using configurable AI agent workflows.
  * Verification processes are cached (e.g., scores in Redis) for speed and incorporate fairness adjustments.
* **Dynamic AI Agent and Workflow Engine:**
  * Define, manage, and execute complex multi-agent workflows (built on LangChain/LangGraph) for various tasks beyond verification, such as data enrichment, analysis, and custom AI processes.
  * Utilizes LLMs from providers including **Atoma**.
  * Persistent storage of workflow definitions in a relational database.
  * CRUD operations for managing these AI workflows via API.
* **AI Model Training and Data Management:**
  * Support for AI model training workflows.
  * Integration with **Walrus** for robust data storage related to training and other platform needs.
* **Comprehensive Analytics:**
  * Platform-level analytics for campaigns and contributors: total contributions, average costs, peak activity, top performers.
  * Weekly analytics on submissions and quality scores.
  * Leaderboards for global contributors and campaign creators.
  * Wallet-specific analytics for contributors.
* **Efficient Task Scheduling:**
  * Automated background tasks, such as marking expired campaigns inactive, managed by Celery and Redis (e.g., running every 30 minutes).
* **Onchain Data Mirroring & Integrity:**
  * Backend mirrors onchain data for performance while ensuring the blockchain (e.g., **Movement chain/Sui**) remains the source of truth.
* **Token-Incentivized Participation:**
  * Rewards for data contributions and other platform activities, managed via the token economy.
* **Secure and Decentralized Foundation:**
  * Leverages blockchain for key aspects like rewards and data provenance.

### 3. Platform Architecture

The Hyvve platform is built on a multi-layered architecture designed for scalability, performance, and robust AI capabilities:

1. **API Layer (FastAPI):** Exposes HTTP endpoints for all platform interactions, including campaign management, data submission, analytics retrieval, and AI workflow management. Handles request validation, (future) authentication, and service orchestration.
2. **Core Backend Services:**
   * **Campaign & Contribution Management:** Handles the lifecycle of data collection initiatives and user submissions.
   * **Analytics Engine:** Processes data to provide insights for users and platform administrators.
   * **Blockchain Interaction Layer:** Manages communication with the underlying blockchain (e.g., Movement chain/Sui), mirroring data and posting transactions.
3. **AI Agent and Workflow Engine:**
   * **Workflow Engine Core (**`EnterpriseWorkflowManager`** based on LangChain/LangGraph):** Compiles and executes dynamic multi-agent AI workflows. Configured to use LLMs from **Atoma** and others.
   * **Workflow Definition Persistence (SQL Database):** Stores AI workflow structures (**`WorkflowDefinitionDB`**) allowing them to be defined, saved, retrieved, and updated.
   * **Caching Layer (Redis):** Caches frequently accessed workflow definitions and AI verification scores to boost performance.
   * **Tooling System:** Equips AI agents with tools to interact with Hyvve's internal services (e.g., campaign data via **`CampaignDataTool`**, contribution updates via **`UpdateContributionVerificationTool`**), external services (e.g., web search), and data platforms like **Walrus**.
4. **Data Storage Layer:**
   * **Relational Database (e.g., PostgreSQL, SQLite via SQLAlchemy):** Stores operational data, user information, campaign details, mirrored onchain data, and AI workflow definitions.
   * **Redis:** Used for caching, session management, and task queuing for Celery.
   * **Walrus:** Integrated for large-scale data storage, particularly for datasets intended for AI model training or generated by AI agents.
5. **Task Scheduling System (Celery & Redis):** Manages asynchronous background tasks critical for platform operations.
6. **External Service Integrations:**
   * Blockchain networks (e.g., Movement chain, Sui).
   * LLM Providers (e.g., **Atoma**, Google).
   * Data Storage Platforms (e.g., **Walrus**).

### 4. Core Technologies

* **Backend Framework:** FastAPI (for high-performance, asynchronous APIs).
* **Database & ORM:** SQLAlchemy (with PostgreSQL, SQLite, etc.).
* **Caching & Message Brokering:** Redis (via `redis.asyncio`).
* **AI Workflow Engine:** LangChain/LangGraph (via `enterprise_workflow.py`).
* **LLM Providers:** Atoma, Google (via API keys like `ATOMASDK_BEARER_AUTH`, `GOOGLE_API_KEY`).
* **Data Validation & Serialization:** Pydantic.
* **Task Queuing:** Celery.
* **HTTP Communication (for tools):** Requests.
* **Data Storage:** Walrus integration for large datasets.

### 5. Data Models

Hyvve utilizes several key data models:

#### 5.1. Hyvve Core Models

* **Campaign:**
  * `id`: Unique identifier (UUID)
  * `onchain_campaign_id`: ID linked to the campaign on the blockchain
  * `creator_wallet_address`: Wallet address of the campaign creator
  * `title`, `description`, `campaign_type`, `data_requirements`, `quality_criteria`
  * `unit_price`, `total_budget`, `min_data_count`, `max_data_count`
  * `expiration`: Expiration timestamp (Unix format)
  * `metadata_uri`, `transaction_hash`, `platform_fee`
  * `is_premium`, `is_active`, `created_at`
* **Contribution:**
  * `contribution_id`: Unique identifier (UUID)
  * `onchain_contribution_id`: Onchain ID for the contribution
  * `campaign_id`: Linked campaign ID
  * `contributor`: Wallet address of the contributor
  * `data_url`: URL for the contribution data (potentially pointing to Walrus for large files)
  * `transaction_hash`
  * `ai_verification_score`: AI verification score for the contribution (from AI agent workflow)
  * `reputation_score`, `quality_score`
  * `is_verified` (status set by AI verification workflow)
  * `reward_claimed`, `created_at`
* **Activity:**
  * `id`: Unique identifier (integer)
  * `campaign_id`, `contribution_id`
  * `timestamp`, `activity_level` (0-100)

#### 5.2. AI Agent Workflow Model

* **WorkflowDefinitionDB (`workflow_definitions` table):**
  * `id` (String, UUID, Primary Key): Internal database ID.
  * `workflow_id_api` (String, Unique, Indexed): API-facing unique identifier for the Hyvve AI workflow.
  * `name` (String, Indexed): Human-readable name of the workflow.
  * `wallet_address` (String, Indexed): Wallet address of the creator/owner of the workflow (linking to Hyvve users).
  * `definition` (SQLJSON): Stores the entire workflow structure (**`WFWorkflowDefinition`** TypedDict) as a JSON object. This includes AI agent configurations (LLM choice from **Atoma**, etc.), nodes, and edges.
  * `created_at`, `updated_at` (DateTime).

### 6. API Endpoints

Hyvve provides a comprehensive set of API endpoints:

#### 6.1. Hyvve Core APIs

* **Campaigns:**
  * `POST /create-campaigns` (Body: `CampaignCreate`): Creates a new campaign.
  * `GET /all`: Retrieves all campaigns with contribution counts.
  * `GET /{creator_wallet_address}/campaigns/created`: Campaigns by creator.
  * `GET /active`: Active campaigns.
  * `GET /{onchain_campaign_id}`: Campaign details by onchain ID.
* **Contributions:**
  * `POST /submit-contributions` (Body: `ContributionCreate`): Submits a contribution.
  * `GET /get-contributions/{onchain_campaign_id}`: Contributions for a campaign.
* **Analytics:**
  * `GET /analytics/campaign/{onchain_campaign_id}`: Campaign analytics.
  * `GET /analytics/campaign/{onchain_campaign_id}/weekly`: Weekly campaign analytics.
  * `GET /analytics/wallet/{wallet_address}`: Contributor analytics.
  * `GET /analytics/leaderboard/global/contributors`: Top contributors.
  * `GET /analytics/leaderboard/global/creators`: Top campaign creators.
* **Contribution Activity:**
  * `GET /analytics/contribution/{contribution_id}/activity`: Activity level of a contribution.

#### 6.2. Hyvve AI Agent Workflow APIs (prefixed e.g., `/agent-workflows`)


The Hyvve AI Agent Workflow APIs provide a comprehensive suite of endpoints for managing and executing sophisticated, AI-driven workflows. These workflows are built using a dynamic, configurable engine that leverages LangChain/LangGraph principles, allowing users to define complex multi-agent systems. These systems can automate various tasks, including data verification, custom data transformations, and orchestrating AI model training processes.

All workflow definitions are persistently stored in a relational database (**`WorkflowDefinitionDB`**) and cached in Redis for optimal performance. The execution of these workflows is handled by the **`EnterpriseWorkflowManager`**, which compiles the defined graph of agents and tools and runs them with the chosen LLM providers like **Atoma** or Google.

**Available LLMs for Agent Configuration:**

Before defining workflows, you can retrieve a list of currently supported LLM models that can be assigned to agents within your workflows.

* `GET /agent-workflows/llms`
  * **Description:** Fetches a list of available LLM model identifiers (e.g., from **Atoma**, Google) that can be used in agent configurations.
  * **Response Body:** `AvailableLLMsResponse`
    ```json
    {
      "llms": [
        "Infermatic/Llama-3.3-70B-Instruct-FP8-Dynamic",
        "deepseek-ai/DeepSeek-V3-0324",
        "mistralai/Mistral-Nemo-Instruct-2407",
        "gemini-1.5-pro-preview-0514"
      ]
    }
    ```

**Workflow Definition Management (CRUD):**

These endpoints allow users to create, retrieve, update, and delete their custom AI workflow definitions.

* `POST /agent-workflows/define`

  * **Description:** Defines and saves a new AI agent workflow. The workflow structure, including its agents, their configurations (LLMs, tools), nodes (steps), and edges (transitions), is specified in the request body.
  * **Request Body:** **`WorkflowDefinitionIn`**
    * `name` (string): A human-readable name for the workflow (e.g., "Data Cleaning and Enrichment Workflow").
    * `wallet_address` (string): The wallet address of the user creating/owning this workflow.
    * `definition_payload` (**`WFWorkflowDefinition`**): A JSON object detailing the entire workflow structure. This includes:
      * `name` (string): Internal name for the definition, should match the outer `name`.
      * `agent_configs` (array of objects): Configurations for each AI agent type used in the workflow. Each config specifies:
        * `name` (string): Unique name for the agent configuration (e.g., "QualityCheckAgent").
        * `system_message_template` (string): The base instructions or role for the agent (e.g., "You are a meticulous data quality verifier..."). Can include placeholders like `{agent_name}`.
        * `llm_choice` (string): The identifier of the LLM to be used by this agent (e.g., obtained from the `/llms` endpoint, like an **Atoma** model).
        * `allowed_tools` (array of strings): A list of tool names (e.g., "`CampaignDataTool`", "`web_search`") that this agent is permitted to use.
      * `nodes` (array of objects): Defines the individual steps (nodes) in the workflow graph. Each node specifies:
        * `id` (string): A unique identifier for this node/step within the workflow (e.g., "data_fetch_step").
        * `agent_config_name` (string): The name of the agent configuration (from `agent_configs`) that will execute this node.
      * `edges` (array of objects): Defines the transitions (edges) between nodes in the workflow graph. Each edge specifies:
        * `source_node_id` (string): The `id` of the node from which this edge originates.
        * `target_node_id` (string): The `id` of the node to which this edge leads. Can also be "END" to terminate the workflow or a branch.
        * `condition` (string): The condition under which this transition occurs (e.g., "ALWAYS", "ON_TOOL_CALL", "ON_NO_TOOL_CALL").
      * `start_node_id` (string): The `id` of the node that serves as the entry point for the workflow.
  * **Response Body:** `WorkflowDefinitionResponse` (includes the created `workflow_id_api`, timestamps, and the full definition).
  * **Internal Logic:**
    * Generates a unique `workflow_id_api`.
    * Validates the input `definition_payload`.
    * Stores the workflow definition in the `workflow_definitions` SQL table (**`WorkflowDefinitionDB`** model).
    * Caches the workflow definition in Redis for faster retrieval.
* `GET /agent-workflows/{workflow_id_api}`

  * **Description:** Retrieves a specific AI workflow definition by its API-facing unique identifier (`workflow_id_api`).
  * **Path Parameter:** `workflow_id_api` (string)
  * **Response Body:** `WorkflowDefinitionResponse`
  * **Internal Logic:** Attempts to fetch the definition from Redis cache first; if not found, queries the database.
* `GET /agent-workflows/by-wallet/{wallet_address}`

  * **Description:** Lists all AI workflow definitions created by a specific user, identified by their `wallet_address`.
  * **Path Parameter:** `wallet_address` (string)
  * **Response Body:** List of `WorkflowDefinitionResponse`
  * **Internal Logic:** Queries the database for all workflow definitions associated with the given wallet address.
* `PUT /agent-workflows/{workflow_id_api}`

  * **Description:** Updates an existing AI workflow definition. The entire new definition must be provided.
  * **Path Parameter:** `workflow_id_api` (string)
  * **Request Body:** **`WorkflowDefinitionIn`** (same structure as the create endpoint)
  * **Response Body:** `WorkflowDefinitionResponse` (with updated details and timestamp)
  * **Internal Logic:**
    * Fetches the existing workflow from the database.
    * Updates its fields with the provided payload.
    * Commits changes to the database and updates the Redis cache.
* `DELETE /agent-workflows/{workflow_id_api}`

  * **Description:** Deletes an AI workflow definition.
  * **Path Parameter:** `workflow_id_api` (string)
  * **Response:** `204 No Content` on successful deletion.
  * **Internal Logic:**
    * Removes the workflow definition from the database.
    * Invalidates/deletes its corresponding entry from the Redis cache.

**Workflow Execution:**

These endpoints are used to initiate and run the defined AI workflows.

* `POST /agent-workflows/run/{workflow_id_api}`
  * **Description:** Executes a previously defined AI workflow identified by `workflow_id_api`.
  * **Path Parameter:** `workflow_id_api` (string)
  * **Request Body:** **`WorkflowRunDetailRequest`**
    * `task_description` (string): The initial input, query, or instruction that the workflow should process.
    * `initial_scratchpad` (object, optional): A JSON object containing any initial data or state that should be available to the agents in the workflow's shared scratchpad.
    * `thread_id` (string, optional): An optional identifier to track or resume a specific workflow run. If not provided, a new one is generated.
  * **Response Body:** `WorkflowRunResponse`
    * `thread_id` (string): The identifier for this specific run.
    * `status` (string): Indicates the outcome (e.g., "COMPLETED", "ERROR", or "PENDING" if run asynchronously).
    * `final_state` (object, optional): The final state of the workflow, which typically includes the messages exchanged and the final content produced by the agents.
    * `message` (string, optional): Any concluding message or error details.
  * **Internal Logic:**
    * Retrieves the workflow definition (from cache or DB).
    * Instantiates the **`EnterpriseWorkflowManager`** with the fetched definition.
    * Invokes the `run_workflow` method on the manager instance, passing the task description and initial scratchpad.
    * The execution can be synchronous (returning the final state) or asynchronous (returning a pending status, with results delivered later or through another mechanism – current code example shows synchronous execution for this endpoint).

**Specialized AI Verification Endpoints (powered by workflows):**

These endpoints leverage the AI workflow engine for specific, common tasks like verifying data contributions. They typically use a system-defined default workflow optimized for verification.

* `POST /agent-workflows/verify-contribution`

  * **Description:** Triggers an AI-powered verification process for a single data contribution. This usually involves a default system workflow (e.g., conceptually, the **`AIDatasetContributionVerifier_SystemDefault`** workflow) designed to assess data quality, relevance, and accuracy.
  * **Request Body:** **`ContributionVerificationRequest`**
    * `contribution_id` (string): The unique identifier of the Hyvve contribution to be verified.
    * `onchain_campaign_id` (string, optional): The onchain ID of the campaign this contribution belongs to.
    * `data_url` (string, optional): Direct URL to the contribution data if not retrievable via `contribution_id` alone.
  * **Response Body:** `WorkflowRunResponse` (similar to the generic run endpoint, indicating the result of the verification workflow).
  * **Internal Logic:**
    * Retrieves or generates a default verification workflow definition (e.g., one that uses agents like **`ContributionDataFetcherAgent`** and **`DatasetQualityVerifierAgent`** with tools like **`CampaignDataTool`** and **`UpdateContributionVerificationTool`**).
    * Instantiates the **`EnterpriseWorkflowManager`** with this verification workflow.
    * Constructs a `task_description` based on the contribution details.
    * Runs the verification workflow. The workflow agents would fetch contribution data, analyze it using an LLM (e.g., from **Atoma**), and update the contribution's `ai_verification_score` and `is_verified` status in the Hyvve database.
    * *Note: This endpoint was commented out in the provided `api_agents.py` but is described here based on its definition in the README and common patterns.*
* `POST /agent-workflows/verify-campaign-dataset`

  * **Description:** Initiates a batch AI verification process for all (or a sample of) contributions within a specified campaign. This is highly useful for campaign creators to assess the overall quality of submitted data.
  * **Request Body:** **`CampaignVerificationRequest`**
    * `onchain_campaign_id` (string): The onchain identifier of the campaign whose contributions are to be verified.
    * `sample_size` (integer, optional): If provided, only this number of contributions from the campaign will be sampled for verification. If omitted, all contributions are targeted.
  * **Response Body:**
    ```json
    {
      "message": "Triggered verification for X contributions. Processing in background.",
      "triggered_count": X,
      "total_found_in_campaign": Y
    }
    ```
  * **Internal Logic:**
    * Fetches all contributions associated with the given `onchain_campaign_id` from Hyvve's core services.
    * Retrieves or generates the default dataset verification workflow (e.g., **`AIDatasetContributionVerifier_SystemDefault`**).
    * For each contribution (or a sample), it adds a task to FastAPI's `BackgroundTasks` (or a more robust Celery queue as a future enhancement).
    * Each background task will instantiate the **`EnterpriseWorkflowManager`** and run the verification workflow for one contribution, similar to the single contribution verification endpoint.
    * The API returns an immediate acknowledgment that the batch verification process has been initiated.

These AI Agent Workflow APIs form the backbone of Hyvve's advanced data processing and automation capabilities, enabling users to create and deploy sophisticated multi-agent systems tailored to their specific needs on the platform.

### 7. AI-Powered Capabilities in Detail

Hyvve's platform integrates sophisticated AI-driven capabilities to automate and enhance various aspects of the data collection and processing lifecycle. Central to this is the dynamic AI Agent and Workflow Engine.

#### 7.1. Advanced AI Verification

Hyvve employs an advanced, multi-agent AI workflow for the verification of data contributions. This system is designed to assess the quality, relevance, and adherence to campaign requirements for submitted data, providing a consistent and intelligent evaluation.

**1. Triggering Verification:**

While data verification can be integrated at various points (e.g., post-contribution via specialized agent workflows like the conceptual **`AIDatasetContributionVerifier_SystemDefault`** mentioned in section 6.2), a primary way to invoke verification for a new submission is through the dedicated endpoint:

* `POST /ai-verification/verify-submission`
  * **Description:** Accepts a data submission (file, associated campaign ID, and contributor wallet) and processes it through a sophisticated AI verification workflow.
  * **Request:** Form data including `onchain_campaign_id`, `wallet_address`, and the `submission_file`.
  * **Response:** `VerificationApiResponse` detailing the decision, score, and reasoning.

**2. Submission Pre-processing:**

Before the AI workflow begins, submitted files undergo pre-processing:

* The uploaded file is saved temporarily.
* The `extract_text_to_temp_file` utility attempts to extract relevant text portions for certain file types:
  * **.txt:** The first non-empty paragraph.
  * **.pdf:** The first non-empty paragraph from the first page's extracted text.
  * **.csv:** The first row of data.
* For other file types (especially images) or if extraction is not applicable/fails, the original file path is used by the workflow. This extracted text or original file path is then passed to the verification workflow.

**3. The `AthenaV2`:**

The `/ai-verification/verify-submission` endpoint utilizes a specifically designed, multi-agent workflow named `AthenaV2`. This workflow is managed by an instance of the **`EnterpriseWorkflowManager`** (referred to as `AIVerificationWorkflowManager` in this context) and orchestrates several specialized AI agents:

* **`FileProcessorAgent`**:

  * **Role:** Initial handling of the submitted file.
  * **Tools:** Uses the **`read_file_content`** tool to determine the file type (image, text, binary) and extract its content or confirm its path.
  * **Output:** Updates the workflow's scratchpad with the file type and content/path, and a routing signal (e.g., "IMAGE_READY_FOR_SCORING", "TEXT_READY_FOR_SCORING", "VERIFICATION_HALTED").
* **`AIVerificationScorerAgent`**:

  * **Role:** Obtains a quality and relevance score for the processed data based on campaign context.
  * **Inputs from Scratchpad:** Receives file path/content, campaign details (description, data requirements, required quality score fetched from the database prior to workflow invocation), and wallet address.
  * **Tools & LLMs:**
    * If image data: Uses the **`get_image_verification_score`** tool, which leverages a Google Vision LLM (e.g., **`gemini-1.5-pro-preview-0514`**) to analyze the image against campaign criteria.
    * If text data: Uses the **`get_text_verification_score`** tool, which can utilize LLMs like Google Gemini or **Atoma** (as configured in **`AppConfig`** and selected by the tool) to evaluate the text's accuracy, alignment, relevance, etc.
  * **Output:** Updates the scratchpad with the raw `verification_score` and a routing signal ("SCORE_OBTAINED" or "VERIFICATION_HALTED").
* **`DecisionMakerAgent`**:

  * **Role:** Makes a final accept/reject decision.
  * **Inputs from Scratchpad:** Receives the `verification_score` from the `AIVerificationScorerAgent` and the `campaign_required_quality_score`.
  * **Tools:** Uses the **`make_verification_decision`** tool, which compares the achieved score against the required threshold.
  * **Output:** Updates the scratchpad with the `final_verification_decision_json` (containing "ACCEPT" or "REJECT", the score, and reasoning) and a routing signal ("DECISION_MADE").

**4. Scoring, Caching, and Fairness:**

* **LLM-Powered Scoring:** The scoring tools (**`get_image_verification_score`**, **`get_text_verification_score`**) make calls to configured LLMs, prompting them with the data and campaign context to derive scores based on various quality dimensions.
* **Caching:** To optimize performance and reduce redundant processing, scores generated by these tools are cached in Redis. Cache keys are constructed using a hash of the file content, wallet address, and relevant campaign parameters, ensuring that we prevent duplicate submissions for the same campaign by the same user.
* **Fairness Adjustments:** Raw scores obtained from the LLMs may undergo a **`apply_fairness_adjustment`** process, which applies minor random adjustments to promote diversity and mitigate potential systemic biases in LLM scoring, before being finalized.

**5. Verification Outcome:**

* The `/ai-verification/verify-submission` endpoint returns a `VerificationApiResponse` containing:
  * `decision`: "ACCEPT" or "REJECT".
  * `score`: The final numeric verification score.
  * `reasoning`: Justification for the decision.
  * `file_type_processed`: Indicates if the file was treated as "image" or "text".
* This outcome (score and verification status) is then available to be recorded against the `Contribution` entry in Hyvve's database, typically by a subsequent process or an extended workflow that might use a tool like the conceptual **`UpdateContributionVerificationTool`**.

This detailed AI verification process ensures that data contributions are evaluated robustly and transparently, leveraging the power of LLMs and configurable agent workflows to maintain high data quality standards within the Hyvve ecosystem.

#### 7.2. AI Model Training and Data Management

Hyvve provides a robust MLOps framework enabling users to take datasets collected or curated on the platform and train AI models. This is facilitated through a combination of direct API interactions for managing datasets and training jobs, and the potential for orchestration via the AI Agent Workflow engine. The platform supports training on local servers for development, as well as scalable cloud-based training on Hugging Face Spaces, AWS SageMaker, and Google Vertex AI.

**1. Data Collection and Preparation for Training:**

* **Campaign-Driven Data Collection:** Campaigns can be specifically designed to gather datasets suitable for AI model training. Data contributors submit various types of data (text, images, documents) which are initially stored.
* **Centralized Storage with Walrus:** Raw contributions are often linked to **Walrus** for efficient, large-scale storage, with metadata managed within Hyvve's `Contribution` records.
* **Automated Dataset Processing:**
  * **Via API:** The `POST /mlops/datasets` endpoint allows for the creation of a **`ProcessedDataset`**. This process can involve fetching all contributions for a specific campaign from **Walrus**, extracting relevant content (e.g., text from documents, paths to images), aggregating this content, and then storing the consolidated, training-ready dataset back into **Walrus** or another specified storage.
  * **Via Workflows:** Alternatively, a **`WFWorkflowDefinition`** can be designed to use tools like the **`DataPreprocessorTool`**. This tool, interacting with the **`WalrusStorageTool`**, can download raw data from **Walrus**, apply custom preprocessing steps (e.g., merging CSVs, concatenating text files, packaging images into archives), and upload the processed dataset, making it available for training jobs.
  * The result of this stage is a **`ProcessedDataset`** entry in Hyvve, which might point to data in **Walrus**, or be staged to cloud storage like S3 or GCS if required by the training platform.

**2. Defining and Launching Training Jobs:**

* **Training Job Specification (`AITrainingJob`):** Users can define AI training jobs via the `POST /mlops/training-jobs` endpoint. A job definition includes:
  * `job_name`: A user-friendly name for the job.
  * `user_wallet_address`: The wallet of the user initiating the job.
  * `processed_dataset_id`: Reference to the **`ProcessedDataset`** to be used.
  * `platform`: The chosen training environment (e.g., `LOCAL_SERVER`, `HUGGING_FACE`, `AWS_SAGEMAKER`, `GOOGLE_VERTEX_AI`).
  * `user_credential_id`: (For cloud platforms) Reference to a **`UserExternalServiceCredential`** containing encrypted API keys/secrets for the chosen platform.
  * `model_type`: Specifies the type of model (e.g., `text-classification`, `image-classification`, `causal-lm`).
  * `hyperparameters`: A flexible JSON object for training hyperparameters (e.g., learning rate, batch size, epochs).
  * `training_script_config`: Configuration specific to the training script and execution environment (e.g., base model ID, entry point script name, instance types, target Hugging Face repository ID).
* **Secure Credential Management:** The `/mlops/user-credentials` endpoints allow users to securely store and manage their encrypted credentials for external services (Hugging Face, AWS, GCP), which are then used by the training runners.
* **Asynchronous Submission:** Creating a training job typically queues a background task (`submit_training_job_to_platform`) that handles the actual setup and submission to the selected training platform. The API returns an immediate acknowledgment.

**3. Multi-Platform Training Execution:**

Hyvve's MLOps system is designed to abstract the complexities of different training environments:

* **Local Server:**
  * **Use Case:** Ideal for development, debugging training scripts, and smaller datasets/models.
  * **Process:** The `execute_local_training_script` function downloads the dataset to a local directory (if not already local) and runs the specified Python training script (e.g., `train_text_classifier.py`, `train_image_classifier.py`, `train_text_lora.py` from the `LOCAL_TRAINING_SCRIPTS_REPO_DIR`) as a local subprocess. Output artifacts and logs are stored locally. Job status is monitored internally.
* **Hugging Face Spaces:**
  * **Use Case:** For leveraging Hugging Face's ecosystem, easy sharing, and running containerized training jobs.
  * **Process:** The `submit_huggingface_training_job` function dynamically:
    1. Uploads the user's dataset to a new or existing Hugging Face Dataset repository if it's not already on the Hub.
    2. Creates a new Hugging Face Space.
    3. Populates the Space with the training script (e.g., `train_text_lora.py`), a wrapper script to manage execution, a Dockerfile, and `requirements.txt`.
    4. Configures necessary secrets (e.g., HF token for pushing results, target model repo ID).
    5. The Space then builds and runs the Docker container, executing the training script.
    6. Upon completion, the trained model (e.g., LoRA adapter) is pushed to a specified Hugging Face Model repository.
    7. A Celery task (`check_huggingface_job_statuses`) periodically monitors these Spaces for completion or errors.
* **AWS SageMaker:**
  * **Use Case:** For scalable, managed training on AWS infrastructure, suitable for large datasets and complex models.
  * **Process:** The `submit_sagemaker_training_job` function:
    1. Configures a SageMaker Estimator (e.g., `HuggingFace` or `PyTorch` estimator).
    2. Uses an appropriate SageMaker execution role and AWS credentials (either user-provided or MLOps system credentials).
    3. Assumes the **`ProcessedDataset`** is already in S3 or stages it there.
    4. Packages the training script (from `LOCAL_TRAINING_SCRIPTS_REPO_DIR`) and dependencies, or points to a local source directory that SageMaker then uploads.
    5. Launches the SageMaker Training Job with specified instance types, hyperparameters, and output S3 locations.
    6. Job status updates are expected via an external mechanism, like an AWS Lambda function (`lambda_sagemaker_event_handler.py`) triggered by SageMaker events via EventBridge, which then calls back to Hyvve's webhook.
* **Google Vertex AI:**
  * **Use Case:** For scalable, managed training on Google Cloud, offering a comprehensive MLOps environment.
  * **Process:** The `submit_vertex_ai_training_job` function:
    1. Uses GCP credentials (user-provided or MLOps system credentials) to interact with Vertex AI.
    2. Assumes the **`ProcessedDataset`** is already in Google Cloud Storage (GCS) or stages it there.
    3. Packages the training script into a Python source distribution or uses a custom container image.
    4. Defines and submits a Vertex AI CustomJob, specifying worker pool configurations (machine type, accelerators), the training package/container, arguments, and GCS output directories.
    5. Job status updates are expected via an external mechanism, like a Google Cloud Function (`gcf_vertex_event_handler.py`) triggered by Vertex AI job status changes via Pub/Sub, which calls back to Hyvve's webhook.

**4. Model Output, Storage, and Centralization:**

* **Artifact Storage:** Trained model artifacts (e.g., model weights, LoRA adapters, tokenizer configurations, metrics files) are saved to platform-specific storage:
  * Local Server: A specified local filesystem path.
  * Hugging Face: A designated Hugging Face Model repository.
  * AWS SageMaker: An S3 bucket.
  * Google Vertex AI: A GCS bucket.
* **Tracking in Hyvve:** The **`AITrainingJob`** record in Hyvve's database is updated with the `output_model_url`, `output_model_storage_type`, and `logs_url`.
* **Centralized Model Hub (Hugging Face):** For jobs completed on cloud platforms (AWS, GCP) or even local jobs, the `process_and_upload_to_hf_background` Celery task can be triggered. This task:
  1. Downloads the trained artifacts from their original cloud storage (S3/GCS) or local path.
  2. (Optionally) Generates a model card.
  3. Uploads the artifacts to a target Hugging Face Model repository specified in the job's configuration.
  4. Updates the **`AITrainingJob`** record with the `huggingface_model_url`.
     This provides a unified place to access models trained via Hyvve.

**5. Orchestration with AI Agent Workflows:**

The MLOps functionalities described above can be seamlessly integrated into and orchestrated by Hyvve's AI Agent Workflow Engine (**`WFWorkflowDefinition`**):

* **Automated MLOps Pipelines:** Users can define workflows where AI agents manage the end-to-end model training lifecycle:
  1. An agent could use the **`DataPreprocessorTool`** or interact with the `/mlops/datasets` API to prepare a **`ProcessedDataset`**.
  2. Another agent could then use the details of the **`ProcessedDataset`** and user-defined configurations to call the `/mlops/training-jobs` API, submitting a new training job to a chosen platform.
  3. Subsequent agents could monitor the job's status by polling the `/mlops/training-jobs/{job_id}` endpoint or by reacting to webhook notifications.
  4. Upon successful completion, an agent could trigger the `process_and_upload_to_hf_background` task (if not automatic) or initiate model deployment/evaluation workflows.
* **Intelligent Parameterization and Decision Making:** LLMs like **Atoma**, when embedded within workflow agents, can assist in:
  * Suggesting optimal hyperparameters based on dataset characteristics or previous runs.
  * Dynamically generating `training_script_config` options.
  * Drafting model cards or summaries based on training metrics.
  * Making decisions on whether to proceed with deployment based on evaluation results.
* **Tool-Based Interaction:** Agents utilize tools like the **`WalrusStorageTool`** for data handling, custom tools that wrap Hyvve's MLOps API endpoints, or tools for interacting with external MLOps platforms.

By combining a flexible MLOps backend with the intelligent orchestration capabilities of the AI Agent Workflow Engine, Hyvve empowers users to build, train, and manage AI models efficiently across diverse computing environments.

#### 7.3. Custom AI Agent Workflows

Beyond the specialized AI verification and model training capabilities, Hyvve's powerful AI Agent and Workflow Engine allows users to define, manage, and execute a wide array of custom multi-agent workflows. This empowers users to automate complex tasks, orchestrate various AI capabilities, and tailor AI-driven processes to their unique data processing and analysis needs.

Users can define these workflows using a structured format, typically a **`WFWorkflowDefinition`**, which specifies:

* **Agent Configurations (`agent_configs`):** Defining each agent's role (via `system_message_template`), the Large Language Model it uses (e.g., from **Atoma**, Google), and the tools it's allowed to access (e.g., `web_search`, **`CampaignDataTool`**, or custom-built tools that might interact with services like **Walrus**).
* **Nodes (`nodes`):** Representing the steps in the workflow, where each node is executed by a configured agent.
* **Edges (`edges`):** Defining the flow of control and data between nodes, based on conditions like successful tool use or specific agent outputs.

These custom workflows are managed via the `/agent-workflows` API endpoints (see section 6.2) and executed by the **`EnterpriseWorkflowManager`**.

**Potential Use Cases for Custom Workflows:**

The flexibility of the workflow engine opens up numerous possibilities, including:

* **Automated Data Cleaning and Transformation:** Design a workflow where one agent identifies anomalies or inconsistencies in a dataset, another agent suggests corrections, and a final agent applies these transformations.
* **Content Generation and Summarization:**
  * An agent could research a topic using web search tools.
  * Another agent could take the research findings and generate a detailed article or report.
  * A final agent could summarize the generated content for different audiences or formats.
* **Sentiment Analysis and Feedback Categorization:** Process user feedback or social media data by having an agent perform sentiment analysis, another agent categorize the feedback by topic, and a third agent flag critical issues.
* **Automated Data Enrichment:** An agent could take a piece of data (e.g., a company name) and use tools to find related information (e.g., website, address, key contacts) from various sources.
* **Anomaly Detection in Datasets:** Configure agents to analyze datasets for unusual patterns or outliers that might indicate errors or interesting phenomena.
* **Connecting and Orchestrating External Services:** Build workflows where agents interact with multiple external APIs or data platforms, consolidate the information, and produce a unified output or trigger further actions. For example, an agent could fetch data from a CRM, process it with an LLM, and then store results in **Walrus**.

**Example: A Simple Research and Summarization Workflow**

Let's illustrate with a workflow designed to research a topic and then summarize the findings.

**1. Workflow Definition (`WFWorkflowDefinition`):**

A user would define this workflow using a `POST` request to `/agent-workflows/define` with a payload similar to this:

```json
{
  "name": "Simple Research Workflow",
  "wallet_address": "0x364d11a2c51F235063b7DB5b60957aE2ea91ACEE",
  "definition_payload": {
    "name": "Simple Research Workflow",
    "agent_configs": [
      {
        "name": "Researcher",
        "system_message_template": "You are a researcher. Find information about history.",
        "llm_choice": "atoma",
        "allowed_tools": ["web_search"]
      },
      {
        "name": "Summarizer",
        "system_message_template": "You are a summarizer. Summarize the information you receive.",
        "llm_choice": "atoma",
        "allowed_tools": []
      }
    ],
    "nodes": [
      {
        "id": "research_step",
        "agent_config_name": "Researcher"
      },
      {
        "id": "summary_step",
        "agent_config_name": "Summarizer"
      }
    ],
    "edges": [
      {
        "source_node_id": "research_step",
        "target_node_id": "summary_step",
        "condition": "ALWAYS"
      },
      {
        "source_node_id": "summary_step",
        "target_node_id": "END",
        "condition": "ALWAYS"
      }
    ],
    "start_node_id": "research_step"
  }
}
```

* **Agents:**
  * `Researcher`: Uses a Google LLM and the `web_search` tool. Its task is to find information.
  * `Summarizer`: Uses an **Atoma** LLM and has no tools. Its task is to summarize information passed to it.
* **Flow:** The `research_step` (executed by `Researcher`) runs first. Its output (the research findings) then "ALWAYS" flows to the `summary_step` (executed by `Summarizer`). After the `Summarizer` completes, the workflow "ALWAYS" ends.

**2. Workflow Execution:**

The user would then run this workflow using `POST /agent-workflows/run/{workflow_id_api}` (where `{workflow_id_api}` is the ID received after defining the workflow), providing an initial task:

* **Request Body (`WorkflowRunDetailRequest`):**
  ```json
  {
    "task_description": "What are the key events in Nigerian history in the 20th century?",
    "initial_scratchpad": {},
    "thread_id": "test_run_1"
  }
  ```

**3. Execution and Response:**

The **`EnterpriseWorkflowManager`** executes the workflow:

* **Step 1: `research_step` (`Researcher` Agent)**

  * The `Researcher` agent receives the task "What are the key events in Nigerian history in the 20th century?".
  * It decides to use its `web_search` tool. The AI message will include a `tool_calls` field indicating the tool name and arguments (e.g., query: "key events in Nigerian history in the 20th century").
  * The `ToolExecutorNode` runs the `web_search` tool, and the results (a list of search snippets) are passed back to the `Researcher` agent in a `ToolMessage`.
  * The `Researcher` agent processes these search results and formulates its findings. Since its `target_node_id` is `summary_step` with condition "ALWAYS", its output (the compiled research) becomes the input for the next agent.
* **Step 2: `summary_step` (`Summarizer` Agent)**

  * The `Summarizer` agent receives the research findings from the `Researcher`.
  * Its system prompt ("You are a summarizer. Summarize the information you receive.") guides it to process this input.
  * Using its configured **Atoma** LLM, it generates a summary.
  * Since its `target_node_id` is "END", the workflow concludes after this step.
* **Final Response (`WorkflowRunResponse`):**
  The API would return a JSON response containing the complete history of messages and the final state:

  ```json
  {
      "thread_id": "test_run_1",
      "status": "COMPLETED",
      "message": null,
      "final_state": {
          "messages": [
          {
              "content": "What are the key events in Nigerian history in the 20th century?",
              "additional_kwargs": {},
              "response_metadata": {},
              "type": "human",
              "name": null,
              "id": null,
              "example": false
          },
          {
              "content": "",
              "additional_kwargs": {
              "function_call": {
                  "name": "web_search",
                  "arguments": "{\"query\": \"key events in Nigerian history in the 20th century\", \"num_results\": 5.0}"
              }
              },
              "response_metadata": {
              "prompt_feedback": {
                  "block_reason": 0,
                  "safety_ratings": []
              },
              "finish_reason": "STOP",
              "model_name": "models/gemini-2.5-pro-preview-05-06",
              "safety_ratings": []
              },
              "type": "ai",
              "name": null,
              "id": "run--6e472acc-c76f-43df-82af-bf718bbd0f60-0",
              "example": false,
              "tool_calls": [
              {
                  "name": "web_search",
                  "args": {
                  "query": "key events in Nigerian history in the 20th century",
                  "num_results": 5
                  },
                  "id": "987a67d7-ef3f-48e1-b707-32ed2588f71f",
                  "type": "tool_call"
              }
              ],
              "invalid_tool_calls": [],
              "usage_metadata": {
              "input_tokens": 126,
              "output_tokens": 33,
              "total_tokens": 185,
              "input_token_details": {
                  "cache_read": 0
              },
              "output_token_details": {
                  "reasoning": 26
              }
              }
          },
          {
              "content": "The 20th century was a transformative period in Nigerian history. Here are the key events:\n\n1. **Colonial Era (1900-1960)**: Nigeria was a British colony, with the country divided into northern and southern regions. The British exploited Nigeria's natural resources and imposed their own system of government.\n2. **Independence (1960)**: Nigeria gained independence from Britain on October 1, 1960, with Nnamdi Azikiwe as the country's first president.\n3. **Civil War (1967-1970)**: A civil war broke out between the government and the separatist state of Biafra, led by Chukwuemeka Odumegwu Ojukwu. The war ended with the defeat of Biafra and the reunification of the country.\n4. **Military Rule (1966-1979, 1983-1999)**: Nigeria experienced a series of military coups, with generals like Yakubu Gowon, Murtala Mohammed, and Sani Abacha ruling the country. This period was marked by corruption, human rights abuses, and economic mismanagement.\n5. **Oil Boom (1970s)**: The discovery of oil in the 1950s transformed Nigeria's economy, but the oil boom of the 1970s also led to corruption, inequality, and environmental degradation.\n6. **Return to Democracy (1979-1983)**: Nigeria returned to democratic rule in 1979, with Shehu Shagari as president. However, this period was short-lived, and the military seized power again in 1983.\n7. **Abacha Regime (1993-1998)**: Sani Abacha's regime was marked by human rights abuses, corruption, and repression. The execution of Ken Saro-Wiwa, a prominent environmental activist, sparked international condemnation.\n8. **Transition to Democracy (1999)**: After Abacha's death, Nigeria transitioned to democratic rule, with Olusegun Obasanjo as president. This marked the beginning of a new era of civilian rule in the country.\n\nThese events have shaped Nigeria's history and continue to influence its politics, economy, and society today.",
              "additional_kwargs": {},
              "response_metadata": {},
              "type": "ai",
              "name": null,
              "id": "e9610097-4bfd-43ae-a8ba-3579865403b7",
              "example": false,
              "tool_calls": [],
              "invalid_tool_calls": [],
              "usage_metadata": null
          }
          ],
          "agent_name": "Summarizer",
          "workflow_scratchpad": {},
          "current_task_description": "What are the key events in Nigerian history in the 20th century?"
      }
  }
  ```

  *(Note: The example response has been slightly abridged for clarity. A full trace would include the `ToolMessage` and potentially more intermediate `AIMessage` objects.)*

This example demonstrates how users can combine different agents, LLMs (like Google's models and **Atoma**'s offerings), and tools to create bespoke AI-driven processes far beyond the built-in functionalities, leveraging the full power of the Hyvve platform.

### 8. Task Scheduling (Celery)

Hyvve uses Celery for managing background tasks essential for platform health and automation:

* **`mark_expired_campaigns_inactive`**: A periodic Celery task (e.g., every 30 minutes) that queries campaigns, checks their `expiration` timestamp, and updates the `is_active` status accordingly.
* Other potential uses: Batch processing of analytics, sending notifications, asynchronous AI workflow initiations.
* Celery uses Redis as its message broker.

### 9. Data Flow Examples for AI Workflows within Hyvve

#### 9.1. Defining a New AI Workflow for Custom Data Processing

1. A Hyvve user (e.g., AI researcher) sends a `POST` request to `/agent-workflows/define` with the workflow's `name`, their `wallet_address`, and the `definition_payload` specifying agents (e.g., data cleaning agent, feature extraction agent using **Atoma** LLMs), their tools (possibly interacting with **Walrus**), and the graph of execution.
2. Hyvve's API validates and saves this definition to the **`WorkflowDefinitionDB`** and caches it in Redis.
3. The user receives a `workflow_id_api` for their new custom workflow.

#### 9.2. Running an AI Verification Workflow on a Campaign's Dataset

1. A campaign creator or admin sends a `POST` request to `/agent-workflows/verify-campaign-dataset` with the `onchain_campaign_id`.
2. Hyvve's API fetches all contributions for that campaign using its internal services (which might use **`CampaignDataTool`**-like logic).
3. It retrieves or creates the standard **`AIDatasetContributionVerifier_SystemDefault`** workflow definition.
4. For each contribution, an AI verification task is added to FastAPI's `BackgroundTasks` (or a Celery queue for more robustness). Each task will:
   * Instantiate the **`EnterpriseWorkflowManager`**.
   * Execute the verification workflow, involving agents fetching data, an **Atoma** LLM performing analysis, and results being saved back to the Hyvve database (updating `ai_verification_score`, `is_verified` for the contribution).
5. The API immediately returns a message indicating how many verification tasks were queued.

### 10. Setup and Running Considerations

* **Environment Variables:** Critical for platform configuration:
  * `SQLALCHEMY_DATABASE_URL`: For Hyvve's main database.
  * `REDIS_URL`: For caching and Celery.
  * `FASTAPI_BASE_URL`: Self-referential or for inter-service communication if microservices are used.
  * `ATOMASDK_BEARER_AUTH`, `GOOGLE_API_KEY`: For Atoma and other LLM providers.
  * Environment variables for **Walrus** connection/authentication.
* **Dependencies:** Python packages like `fastapi`, `uvicorn`, `sqlalchemy`, `psycopg2-binary` (or other DB drivers), `redis`, `requests`, `celery`, and the custom `enterprise_workflow.py` module.
* **Server Execution:** Typically `uvicorn main_api:app --host 0.0.0.0 --port <port> --reload`. Multiple processes for Celery workers would also be run.

### 11. Future Enhancements

* **Robust Asynchronous Task Processing:** Transition more background tasks (especially complex AI workflows) from FastAPI's `BackgroundTasks` to a more comprehensive Celery setup for better scalability, retries, and monitoring.
* **Advanced Security:** Implement OAuth2 and role-based access control (RBAC) across all Hyvve APIs.
* **Comprehensive Logging & Monitoring:** Integrate with ELK stack or Prometheus/Grafana for platform-wide observability.
* **Distributed LangGraph Checkpointer:** For the AI workflow engine, use a distributed checkpointer (Redis or SQL-backed) to allow workflows to be paused/resumed across multiple API/worker instances.
* **Enhanced Walrus Integration:** Develop more specialized agent tools for seamless data manipulation and versioning within **Walrus**.
* **Full MLOps Integration:** Deeper integration with MLOps platforms for end-to-end AI model lifecycle management initiated from Hyvve workflows.
* **Input/Output Schemas for Workflow Steps:** Enforce stricter schemas for data exchanged between AI agents for improved workflow reliability.
* **Database Migrations:** Use Alembic for managing database schema evolution.
* **Expanded Onchain Capabilities:** Further leverage the blockchain for data provenance, access control, and transparent reward distribution for AI-related tasks.

---

*Note: While Hyvve's backend and AI engine optimize performance and enable sophisticated computations by mirroring and processing data, the chosen blockchain (e.g., Movement chain, Sui) remains the definitive source of truth for all fundamental onchain records and asset ownership.*
