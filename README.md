# datascale

An AI-assisted dataset annotation platform that runs entirely within your tailnet — private, fast, and built for teams.

SPUR Founder Track winner at Hack Canada 2026! Check out the Devpost here :-) https://devpost.com/software/datascale

## Demo

[![Watch the demo](https://img.youtube.com/vi/jEqFOQzjBxE/0.jpg)](https://www.youtube.com/watch?v=jEqFOQzjBxE)


## Inspiration

One of our team members was once responsible for annotating sensitive medical imaging research data. This is a product of a realization that there is too much friction between maintaining dataset privacy and team annotator collaboration. 

## Features

- **AI-Assisted Annotation** — Leverage an integrated AI service to auto-suggest labels, dramatically speeding up the annotation workflow
- **Private by Design** — Deployed entirely on your Tailnet; no data leaves your private network
- **Role-Based Access** — Tailscale ACL policies gate access per user, keeping annotators, reviewers, and admins in their lanes
- **Real-Time Collaboration** — Multiple annotators can work simultaneously across the same dataset
- **Export Ready** — Annotated datasets can be exported in standard formats for immediate use in model training pipelines

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Python](https://www.python.org/) 3.10+
- [Tailscale](https://tailscale.com/) installed and authenticated on all machines
- A Tailscale auth key (for service-to-service communication on the tailnet)


## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/t9nzin/datascale.git
cd datascale
```

### 2. Configure Tailscale

Apply the example ACL policy to your Tailnet via the Tailscale admin console:

```bash
# Reference the example policy included in the repo
cat acl_policy_example.json
```

Ensure all services (client, server, ai-service) are joined to the same tailnet before proceeding.

### 3. Start the AI service

```bash
cd ai-service
pip install -r requirements.txt
python main.py
```

### 4. Start the server

```bash
cd server
npm install
npm run dev
```

### 5. Start the client

```bash
cd client
npm install
npm run dev
```

The app will be accessible at the client's Tailscale IP address. Only devices on your tailnet can reach it.


## Built With

| Layer | Technology |
|---|---|
| **Frontend** | React, Vite, Zustand |
| **Backend** | Node.js, Express, SQLite |
| **AI Service** | FastAPI, MobileSAM, SAM2, Ollama, YOLO-World |
| **Infrastrucure** | Tailscale Serve, Tailscale ACLs  |

## License

[MIT](https://choosealicense.com/licenses/mit/)
