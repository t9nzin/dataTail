FROM python:3.10-slim

WORKDIR /app

# Install system deps (for torch / sam / etc if needed)
RUN apt-get update && apt-get install -y \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy code + weights (big files — better to COPY late if you change code often)
COPY . .

# If you need GPU → add --gpus all when running or in compose
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
# For dev hot-reload: CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
