# Rozgo - Intelligent Service Booking Platform

Welcome to **Rozgo**, the premium AI-driven local service matching platform designed for absolute speed, reliability, and precision. Rozgo connects consumers with top-rated local professionals in real-time, utilizing advanced LLM intent parsing, dynamic matching algorithms, and ultra-smooth tracking visuals.

## 🚀 Hackathon Winning Features

### 🧠 LLM-Powered Intent Parsing
Rozgo natively integrates with Gemini AI to understand the natural language of the user. Whether you say "I have a leaky pipe" or "Need someone to fix the AC", the backend mathematically categorizes the service type, gauges the urgency, assesses the complexity tier, and matches it with the right service professionals.

### 📍 Mathematical Coordinate Shifting & Real-Time Proximity (2-3 km)
The matching system respects the user's actual device GPS. Rozgo guarantees that matched providers are mathematically mapped **exactly between 1.5 and 2.8 kilometers** away from the consumer's location. This ensures highly realistic, hackathon-level accurate map demonstrations no matter where in the world the app is tested.

### 🏎️ Smooth 20Hz Easing Map Interpolation
Gone are the days of flickery map tracking! Rozgo uses a custom 20fps easing interpolation algorithm integrated natively with the **Google Maps SDK**. When a booking is accepted, the provider's vehicle smoothly glides street-by-street towards the user's location with dynamic camera refitting.

### 🗄️ Robust TiDB SQL Backend Architecture
The system runs on a robust Sequelize + TiDB (MySQL) backend with cleanly structured associative tables:
* **Users** (Consumers tracking their requests)
* **Providers** (Service professionals with real-time ratings, reviews, and completion data)
* **Bookings** (Financial tracking, complexity metrics, dynamic status flows)
* **Chats** & **Reviews** (History storage and dynamic feedback systems)
* Automated TiDB schema synchronizations to prevent column drift.

### 🛡️ Secure Verification & Error-Free Flows
- **Strict Validations:** Built-in 13-digit strict Pakistani CNIC validation (frontend & backend).
- **Auto-Reassignment:** If a provider is unavailable, the backend automatically reroutes the request and dynamically assigns the next available provider.

---

## 🛠️ Technology Stack

**Frontend:**
- Pure Vanilla JavaScript, HTML, CSS (Lightning Fast, zero bloat)
- Google Maps JavaScript SDK
- Glassmorphism & Modern Easing Animations

**Backend:**
- Node.js & Express.js
- Sequelize ORM
- TiDB Cloud Database (MySQL)
- Google Gemini API (Service orchestration & NLP)

---

## 💻 Running the App Locally

Rozgo has a unified architectural design. The Express backend serves the API and the static frontend application over a single port, circumventing any CORS issues.

1. **Install Dependencies:**
   ```bash
   cd locally-backend
   npm install
   ```

2. **Setup the Environment Variable (`locally-backend/.env`):**
   You need standard TiDB connection credentials and a Google Gemini API Key.

3. **Run the Application:**
   ```bash
   npm start
   ```

4. **Access:**
   Navigate to `http://localhost:5000` in your web browser.

---

## 🎭 Demo Access Roles
- **Consumer:** Login with generic demo user using code `USER-2026`.
- **Provider:** Login via the Provider portal with code `PROV-2026`.

*Designed and engineered for peak performance and visual excellence.*
