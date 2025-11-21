import logging
import requests
import time
from datetime import datetime, timezone

from celery import Celery
from sqlalchemy.orm import Session, selectinload
from huggingface_hub import model_info, space_info # For checking HF resources
from huggingface_hub.utils import RepositoryNotFoundError, HfHubHTTPError # Specific exceptions

# Assuming your project structure and necessary imports
from app.core.database import SessionLocal
import app.ai_training.models as ai_models
from app.core.enums.ai_training import JobStatus, TrainingPlatform, ModelStorageType

from app.core.constants import BASE_URL, API_KEY, REDIS_URL
from app.campaigns.models import Campaign


# Create a Celery app
celery_app = Celery('tasks', broker=REDIS_URL)
logger = logging.getLogger(__name__)


DEFAULT_JOB_TIMEOUT_SECONDS = 6 * 60 * 60  # Default to 6 hours, for example

@celery_app.task(name="app.celery.celery.check_huggingface_job_statuses") # Use a unique name
def check_huggingface_job_statuses():
    """
    Periodically checks the status of active Hugging Face training jobs
    and updates their status in the database.
    """
    db: Session = SessionLocal()
    try:
        active_hf_jobs = db.query(ai_models.AITrainingJob).options(
            selectinload(ai_models.AITrainingJob.user_credential)  # Eagerly load user_credential
        ).filter(
            ai_models.AITrainingJob.platform == TrainingPlatform.HUGGING_FACE,
            ai_models.AITrainingJob.user_credential_id.isnot(None),  # Ensure a credential is linked
            ai_models.AITrainingJob.status.notin_([
                JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED
            ])
        ).all()

        if not active_hf_jobs:
            logger.info("No active Hugging Face jobs with credentials to check.")
            return

        logger.info(f"Found {len(active_hf_jobs)} active Hugging Face jobs to check.")

        for job in active_hf_jobs:
            logger.info(f"Checking status for HF job ID: {job.id}, Name: {job.job_name}, Current Status: {job.status.value}")

            # With the .isnot(None) filter and eager loading, job.user_credential should exist.
            # The main remaining failure point for the token is decryption.
            hf_user_token = job.user_credential.secret_key # Access the hybrid property

            if not hf_user_token:
                logger.warning(f"Job {job.id}: HF token could not be retrieved (likely decryption issue or key not set). Marking as FAILED.")
                job.status = JobStatus.FAILED
                job.error_message = (job.error_message or "") + "; Status Check Failed: Unable to retrieve/decrypt HF token."
                job.completed_at = datetime.now(timezone.utc)
                job.updated_at = datetime.now(timezone.utc)
                continue

            target_model_repo_id = (job.training_script_config or {}).get("hf_target_model_repo_id")
            space_repo_id = job.external_job_id

            if not target_model_repo_id:
                logger.warning(f"Job {job.id}: Target model repo ID (hf_target_model_repo_id) not configured. Marking as FAILED.")
                job.status = JobStatus.FAILED
                job.error_message = (job.error_message or "") + "; Misconfiguration: hf_target_model_repo_id missing."
                job.completed_at = datetime.now(timezone.utc)
                job.updated_at = datetime.now(timezone.utc)
                continue

            model_repo_populated = False
            space_is_errored = False
            space_is_stopped_or_sleeping = False
            current_space_stage = "UNKNOWN" # Default

            # 1. Check Target Model Repository
            try:
                logger.info(f"Job {job.id}: Checking model repo '{target_model_repo_id}' with user token.")
                repo_details = model_info(repo_id=target_model_repo_id, token=hf_user_token)
                expected_artifacts = ["adapter_model.safetensors", "adapter_config.json"] # Adjust as needed
                sibling_filenames = {file_info.rfilename for file_info in repo_details.siblings}
                
                if any(artifact in sibling_filenames for artifact in expected_artifacts):
                    model_repo_populated = True
                    logger.info(f"Job {job.id}: Target model repo '{target_model_repo_id}' found and appears populated.")
                else:
                    logger.info(f"Job {job.id}: Target model repo '{target_model_repo_id}' found, but key artifacts missing. Files: {sibling_filenames}")
            except RepositoryNotFoundError:
                logger.info(f"Job {job.id}: Target model repo '{target_model_repo_id}' not found yet.")
            except HfHubHTTPError as e:
                log_msg = f"Job {job.id}: HTTP error checking model repo '{target_model_repo_id}': {e.response.status_code}"
                if hasattr(e.response, 'text'): log_msg += f" - {e.response.text}"
                logger.error(log_msg)
                if e.response.status_code == 401:
                    job.status = JobStatus.FAILED
                    job.error_message = (job.error_message or "") + f"; HF API Error (Model Repo): Unauthorized access using token for credential ID {job.user_credential_id}."
                    job.completed_at = datetime.now(timezone.utc)
            except Exception as e:
                logger.error(f"Job {job.id}: Unexpected error checking model repo '{target_model_repo_id}': {e}", exc_info=True)

            # 2. Check Space Status
            if space_repo_id:
                try:
                    logger.info(f"Job {job.id}: Checking Space '{space_repo_id}' status with user token.")
                    space_details = space_info(repo_id=space_repo_id, token=hf_user_token)
                    if space_details.runtime:
                        current_space_stage = space_details.runtime.stage
                    logger.info(f"Job {job.id}: Space '{space_repo_id}' current stage: {current_space_stage}")
                    if current_space_stage == 'ERRORED':
                        space_is_errored = True
                    elif current_space_stage in ['STOPPED', 'SLEEPING']:
                        space_is_stopped_or_sleeping = True
                except RepositoryNotFoundError:
                    logger.warning(f"Job {job.id}: Space repo '{space_repo_id}' not found.")
                except HfHubHTTPError as e:
                    log_msg = f"Job {job.id}: HTTP error checking Space '{space_repo_id}': {e.response.status_code}"
                    if hasattr(e.response, 'text'): log_msg += f" - {e.response.text}"
                    logger.error(log_msg)
                    if e.response.status_code == 401:
                        job.status = JobStatus.FAILED
                        job.error_message = (job.error_message or "") + f"; HF API Error (Space): Unauthorized access using token for credential ID {job.user_credential_id}."
                        job.completed_at = datetime.now(timezone.utc)
                except Exception as e:
                    logger.error(f"Job {job.id}: Unexpected error checking Space '{space_repo_id}': {e}", exc_info=True)
            else:
                logger.warning(f"Job {job.id}: Space ID (external_job_id) not set. Cannot check Space runtime status.")


            # 3. Decision Logic (Proceed only if job status hasn't been set to FAILED by API errors above)
            job_updated_this_cycle = False
            if job.status not in [JobStatus.FAILED]: # Check if already marked FAILED due to auth error etc.
                if model_repo_populated:
                    logger.info(f"Job {job.id}: Model repo '{target_model_repo_id}' is populated. Marking job as COMPLETED.")
                    job.status = JobStatus.COMPLETED
                    job.output_model_url = f"https://huggingface.co/{target_model_repo_id}"
                    job.huggingface_model_url = job.output_model_url
                    job.output_model_storage_type = ModelStorageType.HUGGING_FACE
                    job.completed_at = datetime.now(timezone.utc)
                    job.error_message = None
                    job_updated_this_cycle = True
                elif space_is_errored:
                    logger.info(f"Job {job.id}: Space '{space_repo_id}' is ERRORED. Marking job as FAILED.")
                    job.status = JobStatus.FAILED
                    job.error_message = (job.error_message or "") + f"; HF Space '{space_repo_id}' reported error stage: {current_space_stage}."
                    job.completed_at = datetime.now(timezone.utc)
                    job_updated_this_cycle = True
                elif space_is_stopped_or_sleeping and not model_repo_populated:
                    logger.info(f"Job {job.id}: Space '{space_repo_id}' is {current_space_stage} but model repo '{target_model_repo_id}' not populated. Marking job as FAILED.")
                    job.status = JobStatus.FAILED
                    job.error_message = (job.error_message or "") + f"; HF Space '{space_repo_id}' is {current_space_stage} but output repo not populated."
                    job.completed_at = datetime.now(timezone.utc)
                    job_updated_this_cycle = True
                else:
                    job_start_time = job.started_at or job.created_at
                    job_age_seconds = (datetime.now(timezone.utc) - job_start_time).total_seconds()
                    job_timeout_seconds = (job.training_script_config or {}).get("hf_space_job_timeout_seconds", DEFAULT_JOB_TIMEOUT_SECONDS)

                    if job_age_seconds > job_timeout_seconds:
                        logger.warning(f"Job {job.id}: Timed out ({job_age_seconds / 3600:.2f} hrs > {job_timeout_seconds / 3600:.2f} hrs). Marking FAILED.")
                        job.status = JobStatus.FAILED
                        job.error_message = (job.error_message or "") + f"; Job timed out after {job_timeout_seconds / 3600:.2f} hours."
                        job.completed_at = datetime.now(timezone.utc)
                        job_updated_this_cycle = True
                    else:
                        logger.info(f"Job {job.id}: No definitive status change. Current status: {job.status.value}. Space stage: {current_space_stage}.")
            
            if job_updated_this_cycle or job.status == JobStatus.FAILED: # Ensure updated_at is set if any change or failure determination
                job.updated_at = datetime.now(timezone.utc)

        db.commit()
        logger.info("Finished checking all active Hugging Face job statuses.")
    except Exception as e:
        logger.error(f"Critical error in Celery task check_huggingface_job_statuses: {e}", exc_info=True)
        db.rollback() # Rollback any partial changes from the loop if a broad error occurs
    finally:
        db.close()

# Defining the task that will call the endpoint
@celery_app.task
def mark_expired_campaigns_inactive():
    """
    Query active campaigns whose expiration timestamp has passed and mark them as inactive.
    """
    db = SessionLocal()
    try:
        now = int(time.time())
        # Query for campaigns that are still active but have passed their expiration date.
        expired_campaigns = db.query(Campaign).filter(
            Campaign.expiration < now,
            Campaign.is_active == True
        ).all()

        # Mark each campaign as inactive.
        for campaign in expired_campaigns:
            campaign.is_active = False

        db.commit()
        print(f"Marked {len(expired_campaigns)} campaigns as inactive.")
    except Exception as e:
        db.rollback()
        print(f"Error marking expired campaigns as inactive: {e}")
    finally:
        db.close()


@celery_app.task
def renew_subscriptions():
    try:
        headers = {
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json'
        }
        response = requests.post(url=BASE_URL, headers=headers)
        response.raise_for_status()  # Check for successful response
        print("process renewed successfully")
    except requests.exceptions.RequestException as e:
        print(f"Error renewing subscriptions: {e}")


# Schedule the task to run every 30 minutes.
celery_app.conf.beat_schedule = {
    'mark-expired-campaigns-inactive-every-30-minutes': {
        'task': 'tasks.mark_expired_campaigns_inactive',
        'schedule': 30 * 60,  # Every 30 minutes (in seconds)
    },
    'renew-subscriptions-12-hours': {
        'task': 'tasks.renew_subscriptions',
        'schedule': 12 * 60 * 60,  # Every 12 hours (in seconds)
    },
    'check-huggingface-job-statuses-every-10-minutes': {
        'task': 'app.celery.celery.check_huggingface_job_statuses',
        'schedule': 2 * 60,  # Every 10 minutes (adjust as needed)
    },
}