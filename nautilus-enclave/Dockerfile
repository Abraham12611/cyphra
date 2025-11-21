# Nautilus Enclave Dockerfile for Cyphra
# Based on AWS Nitro Enclaves requirements

FROM amazonlinux:2

# Install system dependencies
RUN yum update -y && \
    yum install -y \
    python3 \
    python3-pip \
    gcc \
    openssl-devel \
    libffi-devel \
    python3-devel \
    rng-tools \
    curl \
    && yum clean all

# Set up Python environment
RUN python3 -m pip install --upgrade pip

# Install Python dependencies for AI/ML and crypto
RUN pip3 install \
    tensorflow-lite-runtime \
    numpy \
    pillow \
    cryptography \
    requests \
    aiohttp \
    fastapi \
    uvicorn \
    pydantic

# Create app directory
WORKDIR /app

# Copy enclave application
COPY enclave_app/ /app/

# Generate RSA keypair for enclave
RUN ssh-keygen -t rsa -b 2048 -f /app/enclave_key -N ""

# Set permissions
RUN chmod +x /app/run.sh

# Start entropy daemon and run application
CMD ["sh", "-c", "rngd -r /dev/urandom -o /dev/random && python3 main.py"]
