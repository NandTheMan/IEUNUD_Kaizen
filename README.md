# IE UNUD Kaizen - Server Deployment Guide

This guide outlines the procedure for deploying and updating the IE UNUD Kaizen system on the central local-network server.

## 1. Initial Server Setup (One-Time)

Before deploying the application, ensure the central PC is configured correctly.

*   **Static IP:** Ensure the server has a static IP assigned by the local router.
*   **Docker Auto-Start:** Ensure Docker runs automatically on system boot.
    ```bash
    sudo systemctl enable docker
    sudo systemctl enable containerd
    ```
*   **Firewall Rules:** Open the necessary ports for local network access.
    ```bash
    sudo ufw allow 3000/tcp  # Frontend
    sudo ufw allow 3001/tcp  # Backend API
    sudo ufw allow 5050/tcp  # pgAdmin (Optional)
    sudo ufw enable
    ```

## 2. First-Time Deployment

SSH into the central PC and follow these steps to launch the system.

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/your-username/IEUNUD_Kaizen.git](https://github.com/your-username/IEUNUD_Kaizen.git)
    cd IEUNUD_Kaizen
    ```

2.  **Configure Environment Variables:**
    Create a `.env` file in the root directory. **Ensure the `NEXT_PUBLIC_API_URL` uses the server's static IP.**
    ```bash
    nano .env
    ```
    *(Refer to the system administrator for the required database passwords and configuration keys).*

3.  **Activate Production Mode:**
    Open `docker-compose.yml` and uncomment the `backend` and `frontend` service blocks.
    ```bash
    nano docker-compose.yml
    ```

4.  **Build and Launch:**
    ```bash
    docker compose build
    docker compose up -d
    ```
    Docker will install dependencies, build the Next.js app, compile the NestJS backend, and start the system in the background.

## 3. Updating the System

When new code is pushed to the `main` branch, run the following commands on the server to update the live system:

```bash
cd IEUNUD_Kaizen
git pull origin main
docker compose build
docker compose up -d
```

Docker will automatically detect the changes, rebuild only the necessary containers, and restart them without affecting the database.

## ⚠️ Important: System Shutdown

Never force power-off the central PC by pulling the plug. To prevent database corruption, always perform a graceful shutdown via the OS or terminal:
```bash
sudo shutdown now
```