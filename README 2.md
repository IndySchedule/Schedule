# Indy Schedule

A modern, customizable schedule countdown tool designed for students, faculty, and staff to track class periods in real time with a clean, branded interface.

---

## Features

### 📅 Dynamic Schedule Management
- Live countdown timer that automatically updates as periods change  
- Includes the official seven-period **Independence High School bell schedule**, Homeroom, and Tuesday–Thursday SOAR handling  
- Automatically applies WCS late-start and half-day dates, with a saved A/B/C fifth-period lunch preference  
- Shows a **Today at Indy** summary with current/next period, dismissal, notices, tomorrow’s schedule, and the daily lunch menu  
- Rename periods, adjust timings, and create personalized schedule sets  
- All schedule data is saved locally and synced through Firebase Firestore  

---

### 🎨 Background & Gradient Customization
- Choose between a **background image** or a **custom gradient**  
- Fine-tune gradient angle, color stops, and opacity  
- Smoothly switch between gradient and image modes  

---

### 🔧 Visual Customization Tools
- Customize the **schedule box** with your preferred background, opacity, and text color  
- Adjust **timer shadow** settings including blur, distance, and angle  
- Full typography controls including font selection and preview  
- All changes apply instantly and persist using localStorage and Firestore  

---

### 🔐 Secure Authentication & Cloud Sync
- Sign in with Google through Firebase Authentication  
- User-specific preferences (schedules, backgrounds, gradients, UI settings) sync securely across devices via Firestore  

---

## Usage
- Open the sidebar to manage schedules, backgrounds, gradients, and display settings  
- Customize freely — changes save instantly and sync across sessions  

---

## Development Notes
- School dates and half days are defined in `school-calendar.js`.  
- Monthly cafeteria items are defined in `lunch-menu.js` using `YYYY-MM-DD` keys. Missing dates automatically link visitors to the official WCS Menus & Nutrition page.  
- Run `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc tests/run-tests.js` to validate calendar behavior and source cleanup.  

---

## License
This project is licensed under the **MIT License**.

---

## Acknowledgments
- Built for **Independence High School (Indy)**  
- Inspired by modern school scheduling needs  
- Designed with clarity, accessibility, and simplicity in mind  
