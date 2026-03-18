# IG Dashboard (Command Center)

A centralized React-based dashboard for tracking and managing the performance of creator accounts (Instagram/TikTok, etc.).

## 🚀 Features

*   **Private Access:** The dashboard is protected via PIN code authentication (Default PIN: `5555`), keeping the data private until unlocked.
*   **Dynamic Data Sources:** Automatically fetches data from connected Google Sheets (published as CSV).
*   **Creator Management:** easily add new creator sources (Name & public CSV link) via the UI. Creator configurations are saved locally for future sessions.
*   **Performance Metrics:** Displays comprehensive metrics including Total Network Views, Gained Followers, Average Engagement Rate, and conversion estimates (OF Subscribers).
*   **Threshold Alerts:** Automatically evaluates account thresholds and dispatches notifications via a Telegram alert system when accounts become "Winners" or scale.
*   **Mock & Live Data Support:** Built to seamlessly transition between live Google Sheet data parsing and mock data generation.

## 🛠 Tech Stack

*   **Framework:** React 19 + Vite
*   **Routing:** React Router v7
*   **Icons:** Lucide React
*   **Data Parsing:** PapaParse (for handling CSV payloads)
*   **Styling:** Custom CSS (Glassmorphism & dark UI theme)

## 📁 Project Structure

*   `src/components/Dashboard.jsx`: The main view containing all metrics, the account leaderboard, and the dynamic creator addition modal. Also handles the PIN auth screen.
*   `src/components/AccountTable.jsx`: Renders the detailed leaderboard with sorting and status indicators for each account.
*   `src/utils/googleSheetsAPI.js`: Fetches and parses CSV data from Google Sheets links.
*   `src/utils/mockData.js`: Generates mock account data for testing purposes.
*   `src/utils/alertSystem.js`: Handles logic for evaluating thresholds and dispatching Telegram alerts.
*   `src/App.jsx`: Sets up the application layout (sidebar, topbar, and routing).
*   `src/App.css` / `index.css`: Global styles, themes, and animations.

## 🚦 Getting Started

### 1. Installation

Install dependencies using npm:

```bash
npm install
```

### 2. Running Locally

Start the Vite development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

### 3. Usage

1.  Open the dashboard.
2.  Enter the 4-digit PIN (`5555` by default) to unlock the application.
3.  The dashboard will automatically sync data for predefined creators ("Rose", "Ariana") by fetching their public Google Sheets CSVs.
4.  To add a new creator, click the "Addition" button, provide the creator's name, and a valid Google Sheets URL (ensure the sheet is published to the web as a CSV).
5.  All added creators are saved to your browser's local storage.

## 🤖 Automations: Make.com & Apify

The project includes an automated data pipeline using **Make.com** and **Apify** to continuously scrape updated data (followers, views, etc.) and write it back into the Google Sheet.

### How it works
1. **Google Sheets (Search Rows):** Make.com searches the Google Sheet for rows containing Instagram links/usernames that are marked as active.
2. **Apify (Run an Actor):** The `apify/instagram-profile-scraper` actor is triggered to scrape the selected profile.
3. **Google Sheets (Update a Row):** Make.com takes the fetched data (`followersCount`, etc.) from Apify and updates the exact row it originally searched.

### ✅ Resolved: "Total Views" Aggregation

The "Total Views" metric is now populated via an Iterator + Numeric Aggregator pipeline in Make.com.

**Make.com scenario flow:**
```
[Google Sheets: Search Rows] → [Apify: Run Actor] → [Apify: Get Dataset Items] → [Iterator] → [Numeric Aggregator] → [Google Sheets: Update Row]
```

**Configuration details:**
1. **Apify: Run Actor** — Uses `apify/instagram-profile-scraper`. Input JSON maps the username dynamically from the Google Sheet (e.g., `{"usernames": ["{{1.username}}"]}`).
2. **Apify: Get Dataset Items** — Dataset ID mapped to `defaultDatasetId` from the Run Actor output. Format: JSON, Transformation: Clean.
3. **Iterator** (Flow Control) — Array set to `latestPosts[]` from Get Dataset Items output.
4. **Numeric Aggregator** (Tools) — Source Module: Iterator. Aggregate function: SUM. Value: `{{ifempty(iterator.videoViewCount; 0)}}` (handles photo posts with no view count).
5. **Google Sheets: Update Row** — Maps the Numeric Aggregator `result` to the "Total Views" column.

**Known limitation:** Apify scrapes public Instagram data which may return slightly stale/cached view counts. Actual views on Instagram can be marginally higher than what the scraper reports. This is a limitation of all Instagram scrapers — for exact real-time metrics, the official Instagram Graph API would be required (needs Business/Creator accounts with Facebook Page connections).
