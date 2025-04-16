#!/bin/bash

cleanup() {
    echo "Stopping servers..."
    kill $(jobs -p)
    exit
}

trap cleanup SIGINT SIGTERM

echo "Starting React frontend..."
(cd frontend && yarn start) &

echo "Starting Flask backend..."
(cd flask-server && source venv/bin/activate && python3 server.py)

wait
