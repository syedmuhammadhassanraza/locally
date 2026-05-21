# Rozgo - Intelligent Service Booking Platform

Welcome to **Rozgo**, the premium AI-driven local service matching platform designed for absolute speed, reliability, and precision. Rozgo connects consumers with top-rated local professionals in real-time, utilizing advanced LLM intent parsing, dynamic matching algorithms, and ultra-smooth tracking visuals.

---

## 🚀 Key Features & Production Updates

### 🧠 LLM-Powered Intent Parsing & Automatic Tracing
Rozgo natively integrates with Gemini AI to understand natural language expressions.
- **Auto-Telemetry Tracing:** Model engineering updates, prompts, files affected, and execution logs are dynamically tracked and appended to `antigravity_trace.txt` and `locally-backend/logs/prompt_history.json`.

### 📍 Device-Native Geolocation & Smart Fallbacks
- **Live Location Prompt:** Upon application startup, the system prompts the user for browser/device Geolocation permissions.
- **Graceful Fallbacks:** If granted, the app centers on the user's real coordinates. If denied, it seamlessly switches to the Rawalpindi coordinate cluster to ensure flawless continuity.

### 📶 Dynamic API Configurations (Production Ready)
- **API Server Override:** Easily configure custom backend IPs or domain names directly from the frontend's **Settings Modal**.
- **Mobile Compatibility:** By storing the custom server endpoint inside LocalStorage (`backend_api_url`), the compiled Capacitor APK discovers the public API instantly from any location.

### 🛡️ Production Telemetry & Logging System
All server behaviors are written to separate log files under `locally-backend/logs/`:
- `runtime.log`: Captures database syncing, boot processes, and exception traces.
- `api_requests.log`: Logs incoming API HTTP requests, latencies, status codes, IPs, and payloads (sensitive data redacted).
- `socket_events.log`: Tracks WebSocket connections, status updates, joins, and location updates.
- `errors.log`: Records stack traces and backend error anomalies.
- `frontend_errors.log`: Receives unhandled frontend script exceptions sent from the mobile or web clients.

---

## 📱 Mobile APK Compilation (Capacitor)

The platform is wrapped into a native Android container using **CapacitorJS**. We've implemented a robust, fully automated build pipeline that compiled the release wrapper successfully using **Gradle**.

### How to Compile the APK (Automated PowerShell Script)
To build a clean native APK wrapper from scratch:

1. **Verify environment setup:** Ensure JDK 17 and Android SDK platforms are installed.
2. **Execute build script:** From the root workspace directory, run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\build-apk.ps1
   ```
This script dynamically:
- Copies the latest static frontend files into the Capacitor web assets bundle (`www/`).
- Invokes `npx cap sync` to update the native Android configurations.
- Resolves read-only Android SDK directory limitations using local system junction links and forced compiler overrides (SDK 35 and Build-Tools 35.0.0).
- Compiles a debug APK (`app-debug.apk`) and places it directly in both the project root and the conversation artifacts folder.

---

## 💻 Running the App Locally

Rozgo uses a unified architecture where the Node.js Express server hosts both the backend APIs and serves the static frontend package.

1. **Install Dependencies:**
   ```bash
   cd locally-backend
   npm install
   ```

2. **Configure Environment Variables (`locally-backend/.env`):**
   Provide the cloud TiDB SQL database credentials, port configuration, and Gemini API keys.

3. **Start the Express API Server:**
   ```bash
   npm start
   ```

4. **Access the Application:**
   Open `http://localhost:5000` in your web browser.

---

## 🎭 Demo Access Roles
- **Consumer Portal:** Login with access code `USER-2026`.
- **Provider Portal:** Login with access code `PROV-2026`.

*Designed and engineered for peak performance, extreme visual excellence, and enterprise-grade reliability.*
