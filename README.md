🚴‍♂️ Project: 42 Campus Bike-Sharing System

 1: Title 
 Title: Local Bike-Sharing System for the 42 Community
 
 Subtitle: A secure, autonomous, and low-cost IoT architecture powered by Ed25519 and the 42 Ecosystem Authors: [Your Name / Team Name]
  2: Problem & Objective
  The Problem: Students need a fast way to move around the campus/city. Commercial bike-sharing solutions are too expensive, while naive DIY smart locks are insecure (vulnerable to replay attacks and packet tampering).
  The Objective: Build a "stupid-simple" (minimalist) IoT architecture for bike-sharing with zero network infrastructure costs and enterprise-grade security.

 3: Security & Cryptography (Fixing Flaws)
 ❌ 
 The Insecure Way: 
 Using a simple hash like sha256(challenge + public_key) is highly vulnerable to interception and spoofing. Storing private keys inside the ESP32 flash memory exposes them to physical extraction.
 ✅
Solution 
  (Asymmetric Cryptography):Ed25519 Algorithm (via mbedtls): Ultra-short, ultra-fast cryptographic keys (only 64-byte signatures), perfectly optimized for BLE packets.Zero-Trust Hardware Architecture: The bicycle only stores the server's public key. The private key never leaves the secure cloud backend. Physically stealing or dismantling the bike yields zero useful data to an attacker.
  4: System Architecture (Cutting Connectivity Costs)The "Smartphone-as-a-Gateway" Concept:The bicycle uses only an ESP32-C3 (BLE + Wi-Fi) and remains in Deep Sleep mode (achieving months of battery life on a single 18650 cell).The bike does not require an expensive GSM/GPS module or cellular subscription.The student's smartphone acts as the internet bridge, fetching data from the backend and passing the unlock command via Bluetooth (BLE).
   
   5: Dual Interfaces — Single Backend (UX for 42)We decoupled the user interface into two independent frontends to fit different user behaviors:
   Slack Bot (Native 42 Workspace Integration):
   Scan QR ➡️ Triggers Slack ➡️ User executes a /rent command or clicks a dynamic interactive button.

   Deep integration with the 42 Intra API: The bot automatically verifies student status (e.g., ensuring they are active and not stuck in a "black hole").
   Autonomous PWA (Progressive Web App):
   A lightweight web application that runs directly inside any smartphone browser.Utilizes the Web Bluetooth API to communicate with the bike directly from the browser (no App Store/Google Play installation required).
   6: Workflow (Challenge-Response Protocol)Scan: The student scans the QR code on the bike using either Slack or the PWA.

   Request:

    The backend validates the student via the Intra API and generates a random cryptographic challenge.
   Sign: 

   The backend signs this challenge using its private Ed25519 key.Transmit: The smartphone forwards this signature to the ESP32 over BLE.
   
   Authorize: 
   
   The ESP32 verifies the signature using the pre-flashed public key and fires the solenoid lock.
   
   7: Bill of Materials (BOM) & Tech StackHardware 
   
   Cost: ~$6–$8 per bicycle (ESP32-C3, MOSFET driver, 12V solenoid lock, 18650 Li-ion battery, TP4056 charging module).
   
   Frontend: HTML/JS (PWA) + Python / Node.js (Slack Bolt API).
   
   Backend: Firebase / AWS (Free Tier — zero hosting costs at launch).
   
   Firmware: ESP-IDF / Arduino Framework + mbedtls.
   
    8: Implementation Roadmap
    
    Phase 1: ESP32 Firmware Development (BLE Server initialization + mbedtls signature verification).
    
    Phase 2: Cloud Backend Development (Ed25519 signing logic + 42 OAuth placeholder setup).
    
    Phase 3: Interface Development (Building the Slack Bot interactive flow and the Web Bluetooth PWA skeleton).
    
    Phase 4: Hardware Integration (Assembling the physical prototype and conducting live campus testing).

📁 Final Project Structure

    Velo/
├── task.md                          # Technical Specifications / Requirements
├── README.md                        # Project Overview
│
├── firmware/esp32_bike_lock/        # ⚡ PHASE 1: ESP32-C3 Firmware
│   ├── platformio.ini               # PlatformIO Configuration
│   ├── get_deps.sh                  # Ed25519 library download script
│   ├── src/main.cpp                 # Firmware (BLE + RNG + Ed25519 + lock control)
│   └── lib/ed25519/
│       ├── ed25519.h                # Ed25519 interface header
│       └── ed25519.c                # Stub implementations + hex_to_bin utility
│
├── backend/                         # ☁️ PHASE 2: Cloud Backend (Express/TS)
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example                 # Environment variables template
│   └── src/
│       ├── index.ts                 # Server entry point
│       ├── crypto/
│       │   ├── ed25519.ts           # Ed25519 handling (native node:crypto)
│       │   └── keygen.ts            # Key generator script (npm run keygen)
│       ├── routes/
│       │   ├── auth.ts              # POST /api/auth/callback (42 OAuth)
│       │   └── rent.ts              # POST /api/rent/challenge (signature verification)
│       └── middleware/
│           └── auth.ts              # 42 Intra token validation middleware
│
├── interfaces/                      # 📱 PHASE 3: User Interfaces
│   ├── slack-bot/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/index.ts             # Slack Bolt Bot implementation (/rent command)
│   └── pwa/
│       ├── index.html               # Progressive Web App UI (Tailwind CSS)
│       ├── app.js                   # Web Bluetooth API + Challenge-Response logic
│       └── manifest.json            # PWA manifest file
│
└── hardware/                        # 🔧 PHASE 4: Hardware
    └── BOM.md                       # Bill of Materials + wiring diagram + assembly guide


    bash# 1. Backend — Key Generation
cd backend
cp .env.example .env
npm install
npm run keygen          # Copy the generated keys to .env and platformio.ini
npm run dev             # Start the server on port :3000

# 2. ESP32 Firmware Flash
cd firmware/esp32_bike_lock
# Update the BACKEND_PUBLIC_KEY_HEX inside platformio.ini
pio run -t upload

# 3. Slack Bot Setup
cd interfaces/slack-bot
npm install
# Configure SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET in your .env file
npm run dev

# 4. Launching the PWA — open in Chrome on your mobile device:
# file:///home/ihavauch/Desktop/Velo/interfaces/pwa/index.html
# (Alternatively, serve it using any lightweight HTTP server)
Use code with caution.