# How to Run This Application

## Prerequisites
- Node.js 22+ (check with `node --version`)
- npm (Node package manager, comes with Node.js)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Run the Server

```bash
npm start
```

Or for development:

```bash
npm run dev
```

The server will start and display:
```
Server running on port 8000
```

## Step 3: Access the Application

Open your browser and go to:
```
http://localhost:8000
```

## API Usage Example

### Upload Image with curl

#### Option 1: Upload Image File (formData)

Upload an image file to the `/upload` endpoint using formData:

```bash
curl -X POST "http://localhost:8000/upload" \
  -F "file=@/path/to/your/image.png"
```

#### Option 2: Upload Image from URL

Upload an image from a URL to the `/upload` endpoint:

```bash
curl -X POST "http://localhost:8000/upload" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/path/to/image.png"}'
```

Example response:
```json
{
  "success": true,
  "colorsCount": 5,
  "colors": [
    "#FF0000",
    "#00FF00",
    "#0000FF",
    "#FFFF00",
    "#FF00FF"
  ],
  "hasBackground": true
}
```

### Health Check

Check if the server is running:

```bash
curl http://localhost:8000/health
```

Response:
```json
{
  "status": "ok"
}
```

## Optional: Using Environment Variables

You can configure the server port by setting the `PORT` environment variable:

```bash
PORT=8000 npm start
```

# Production Deployment on EC2

This section covers deploying the application on a fresh EC2 instance with persistent service management.

## Step 1: Update System Packages

### For Amazon Linux 2023:
```bash
sudo dnf update -y
```

## Step 2: Install Node.js and npm using nvm

### For Amazon Linux 2023:
```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Load nvm into the current shell session
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js 24
nvm install 24.13.0
# Or install the latest LTS version:
# nvm install --lts

# Set Node.js 24.13.0 as the default version
nvm use 24.13.0
nvm alias default 24.13.0

# Verify Node.js and npm versions
node --version
npm --version
```

**Note**: To make nvm available in new shell sessions, add the following to your `~/.bashrc` or `~/.zshrc`:
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

## Step 3: Set Up Application Directory

```bash
# Upload your application files (using scp, git, or other method)
scp -i ~/.ssh/tripod.pem -r color-detector/ ec2-user@your-ec2-ip:/home/ec2-user/color-detector/

# Navigate to directory
cd /home/ec2-user/color-detector
```

## Step 4: Install Dependencies

```bash
cd /home/ec2-user/color-detector

# Install Node.js dependencies
npm install
```

## Step 6: Create Systemd Service for Persistent Running

Create a systemd service file to run the application as a persistent service:

```bash
sudo nano /etc/systemd/system/color-detector.service
```

Add the following content:

First, find the path to your Node.js installation:
```bash
which node
# This will output something like: /home/ec2-user/.nvm/versions/node/v18.20.4/bin/node
```

Then create the service file with the following content:

```ini
[Unit]
Description=Color Detector Application
After=network.target

[Service]
Type=simple
User=ec2-user
Group=ec2-user
WorkingDirectory=/home/ec2-user/color-detector
Environment="NODE_ENV=production"
Environment="PORT=8000"
Environment="PATH=/home/ec2-user/.nvm/versions/node/v24.13.0/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/home/ec2-user/.nvm/versions/node/v24.13.0/bin/node /home/ec2-user/color-detector/node_modules/.bin/ts-node /home/ec2-user/color-detector/server.ts
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=color-detector

[Install]
WantedBy=multi-user.target
```

**Note**: 
- Replace `v24.13.0` in both the PATH and ExecStart with your actual Node.js version path (from `which node` command)

## Step 7: Enable and Start the Service

```bash
# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable color-detector.service

# Start the service
sudo systemctl start color-detector.service

# Check service status
sudo systemctl status color-detector.service
```

## Step 8: Verify the Application is Running

```bash
# Check if the service is running
sudo systemctl status color-detector.service

# View recent logs
sudo journalctl -u color-detector.service -f

# Test the application (replace with your EC2 public IP)
curl http://localhost:8000/health
```

## Troubleshooting

### Check Logs
```bash
# View all logs
sudo journalctl -u color-detector.service

# View last 50 lines
sudo journalctl -u color-detector.service -n 50

# Follow logs in real-time
sudo journalctl -u color-detector.service -f
```

### Restart Service
```bash
sudo systemctl restart color-detector.service
```

### Stop Service
```bash
sudo systemctl stop color-detector.service
```

### Check Port Usage
```bash
sudo netstat -tulpn | grep 8000
```
