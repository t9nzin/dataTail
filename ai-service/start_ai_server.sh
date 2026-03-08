#!/bin/bash
set -e

cleanup() {
  echo "Stopping Ollama..."
  kill $OLLAMA_PID 2>/dev/null || true
}

trap cleanup EXIT INT TERM

# Only create venv if it doesn't exist
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install packages
pip install --upgrade pip
pip install git+https://github.com/ChaoningZhang/MobileSAM.git
pip install -r requirements.txt

# Install ollama only if it isn't installed
if ! command -v ollama >/dev/null 2>&1; then
  echo "Installing Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh
else
  echo "Ollama already installed."
fi

pkill -f "ollama serve" 2>/dev/null || true

# Start ollama in background
ollama serve &
OLLAMA_PID=$!

# Pull model
ollama pull qwen2.5:3b

# Run the app (foreground)
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000
