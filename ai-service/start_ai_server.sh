#!/bin/bash
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

# Run the app
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000
