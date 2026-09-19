<div align="center">

  <img src="icons/icon128.png" alt="EWU Buddy Logo" width="96" height="96" style="border-radius: 20px; box-shadow: 0 10px 30px rgba(217, 78, 52, 0.4);" />

  # ⚡ EWU Buddy — Portal Helper
  ### *The Ultimate Intelligent Student Portal Assistant for East West University*

  <p align="center">
    <a href="https://github.com/starkxxxwiz/ewu-ext"><img src="https://img.shields.io/badge/Manifest-V3-d94e34?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Manifest V3" /></a>
    <a href="https://github.com/starkxxxwiz/ewu-ext"><img src="https://img.shields.io/badge/Version-1.2.0_Production-0284c7?style=for-the-badge&logo=semver&logoColor=white" alt="Version 1.2.0" /></a>
    <a href="https://github.com/starkxxxwiz/ewu-ext/commits/main"><img src="https://img.shields.io/github/commits-since/starkxxxwiz/ewu-ext/0.0.1?style=for-the-badge&color=10b981&logo=git&logoColor=white" alt="Commits" /></a>
    <a href="https://github.com/starkxxxwiz/ewu-ext"><img src="https://img.shields.io/badge/Platform-Windows_/_Mac_/_Android-f59e0b?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Supported Platforms" /></a>
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=black" />
    <img src="https://img.shields.io/badge/HTML5-Modern_Semantic-E34F26?style=flat-square&logo=html5&logoColor=white" />
    <img src="https://img.shields.io/badge/CSS3-EWU_Terracotta_&_Navy-1572B6?style=flat-square&logo=css3&logoColor=white" />
  </p>

  <p align="center">
    <b>Auto Captcha Solving</b> • <b>10-Column Advising Suite</b> • <b>Ultra-HD Routine Generator</b> • <b>Seat Heatmaps</b> • <b>Offline Course Planner</b>
  </p>

</div>

---

## 🚀 Features & Capabilities

### ⚡ 1. Automatic Captcha Solver
* Instantly solves the mathematical number captcha on the student portal login page (`portal.ewubd.edu`).
* Fast submission triggers so you can log in smoothly without typing numbers manually.

### 📅 2. Routine & Timetable Generator
* Automatically detects registered courses and builds a visual weekly timetable schedule.
* **Official EWU Academic Calendar Integration (Semester & Holiday-Aware)**:
  * Dynamically queries the official EWU academic calendar for the current semester (e.g. `https://www.ewubd.edu/academic-calendar-details/{semester-slug}`).
  * Extracts the official **First Day of Classes** and **Last Day of Classes** to determine recurring schedule boundaries.
  * Dynamically extracts all university holidays, including single-day and **multi-day holiday ranges** (e.g., Durgapuja, Victory Day, Christmas Day).
  * Automatically filters holidays strictly between the first day and last day of classes for pristine calendar accuracy.
  * Generates standard RFC 5545 iCalendar (`.ics`) files with `RRULE` recurrence and holiday exception dates (`EXDATE`) so classes automatically skip official holidays and end on the true last day of classes.
* **Smart Drop/Withdraw Filter**: Excludes dropped and withdrawn courses from routine schedules and total credit calculations.
* **Dynamic Active Days**: Automatically omits empty days (such as days with no classes) for a clean, compact grid.
* **1-Click Multi-Format Export**: Export high-resolution schedule images (**PNG**), document sheets (**PDF**), and semester-aware iCalendar (**`.ics`**) files to sync weekly classes directly into Google Calendar, Apple Calendar, and Outlook.

### 🎯 3. Advising Assistant & Course Planner (Online & Offline)
* **10-Column Advising Suite**: Enriched table displaying section info, faculty initials, room numbers, seat capacities, and remaining live seats.
* **Seat Heatmap**: Visual green/amber/red occupancy indicators to instantly spot open sections during rush advising.
* **Instant Filter**: Search courses and faculty initials quickly with the `Ctrl+K` keyboard shortcut.
* **Drag & Drop Planning**: Drag course cards into semester plan dropzones with automatic schedule conflict checking.
* **Routine Preview in Planner**: Interactive modal to visualize and export routines of planned combinations before finalizing advising.

### 📚 4. Offered Courses Catalog Enhancer
* Sticky table headers keep column names in view while scrolling through large course lists.
* Quick filtering by course code, department, or instructor name.
* Beautiful PDF catalog generator with sleek gradient styling.

### 🎨 5. Responsive EWU Campus Visuals & Aesthetic UI
* **Orientation-Aware Backgrounds**: Displays high-resolution landscape campus photography on desktop/laptop screens and automatically adapts to portrait photography on vertical mobile screens.
* **Authentic EWU Identity**: Styled with EWU building terracotta brick red accents and student portal deep ocean navy slate tones.
* **Modern Minimal Buttons**: Tactile, sleek buttons with micro-interactions, responsive sizing, and high-contrast accessibility.

---

## 🧭 First-Start Onboarding Experience

When you install EWU Buddy for the first time, a guided 4-step setup wizard welcomes you:

1. **Step 1: Terms & Conditions**: Read the terms summary and accept to proceed.
2. **Step 2: Features & Essential Knowledge**: Discover key features, interactive tools, and tips for getting the most out of the extension.
3. **Step 3: Licence Activation**: Enter your 16-character license key (`XXXX-XXXX-XXXX-XXXX`) to unlock all features.
4. **Step 4: Subscribed & Ready**: View your activation details and launch directly into the EWU Portal.

---

## 📥 How to Download the Extension

You can download **EWU Buddy** using either of the following methods:

### 🔹 Option A: Download from GitHub Releases (Recommended)
1. Go to the [**Releases**](https://github.com/starkxxxwiz/ewu-ext/releases) section on the right-hand sidebar of this repository.
2. Under **Assets**, click on `ewu-buddy-v1.2.zip` to download the pre-packaged archive directly.

### 🔹 Option B: Download Repository Source ZIP
1. Scroll to the top of this GitHub repository page.
2. Click the green **Code** button &rarr; click **Download ZIP**.
3. Extract the `.zip` archive on your device.

---

## 🛠️ Installation Guide

### 📱 For Android Phones / Tablets (Kiwi Browser, Quetta, Lemur)
You can use Chromium browsers with extension support (such as **Kiwi Browser** or **Quetta Browser**):

1. Install **Kiwi Browser** or **Quetta Browser** from Google Play Store.
2. Download the extension `.zip` file from the [Download section](#-how-to-download-the-extension).
3. Open your mobile browser and tap the **⋮ (three dots menu)** in the top-right corner.
4. Select **Extensions** (or navigate to `chrome://extensions`).
5. Turn **ON** the **Developer mode** toggle in the top-right corner.
6. Tap the **+ (from .zip / .crx / .user.js)** button.
7. Choose the downloaded `.zip` file from your device storage.
8. ✨ **Done!** The extension installs directly into your mobile browser.

---

### 🖥️ For PC / Desktop / Laptop (Chrome, Brave, Edge, Opera)

1. Download the extension `.zip` file and **extract** it to a folder on your computer.
2. Open your Chromium-based browser (Google Chrome, Brave, Microsoft Edge, Opera, Vivaldi, etc.).
3. Open the Extensions management page:
   - **Google Chrome**: Navigate to `chrome://extensions/`
   - **Brave Browser**: Navigate to `brave://extensions/`
   - **Microsoft Edge**: Navigate to `edge://extensions/`
4. Turn **ON** the **Developer mode** toggle in the top-right corner.
5. Click the **Load unpacked** button in the top-left corner.
6. Select the extracted extension directory (the folder containing `manifest.json`).
7. ✨ **Done!** The EWU Buddy icon will appear in your browser toolbar.

---

## 🔑 License Activation & Management

1. Upon first install, the **Onboarding & Activation** page will open automatically (or click the **EWU Buddy** icon in your browser toolbar &rarr; **Licence** tab).
2. Enter your 16-character license key (e.g. `XXXX-XXXX-XXXX-XXXX`).
3. Click **Verify & Activate License**.
4. Once activated, your license status is permanently saved on your browser and verified seamlessly.
5. You can manage your license anytime from the extension popup under the **Licence** tab to check days remaining, sync status, or change keys.

---

## ⚠️ Disclaimer & Takedown Policy

> [!IMPORTANT]
> **EWU Buddy** is an independent, community-developed productivity utility designed strictly for educational and personal assistance purposes.
> 
> - This project is **not** officially affiliated with, endorsed by, or operated by East West University (EWU).
> - All trademarks, logos, and portal interfaces belong to their respective copyright holders.
> - If East West University authorities or relevant copyright owners have questions, concerns, or wish to request modification or takedown of any feature, please reach out directly:
>   - **Direct Contact (Telegram)**: [@AftabKabir](https://t.me/AftabKabir)
>   - **Issue Tracker**: Submit a request via [GitHub Issues](https://github.com/starkxxxwiz/ewu-ext/issues).

---

## 💬 Support & Inquiries

Need a license key, having trouble installing, or want to suggest a new feature?
- Reach out directly on Telegram: **[@AftabKabir](https://t.me/AftabKabir)**

---

<div align="center">
  <sub>Crafted with ❤️ for East West University Students. Copyright © 2026 EWU Buddy. All rights reserved.</sub>
</div>
