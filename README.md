# Insurance Claims Intake and Case Management

A browser-based insurance claims intake and case management showcase built with React and Syncfusion. Explore sample claims across a performance dashboard, searchable claims list, kanban workflow, and editable claim detail view.

> This is a demonstration app, not a production claims system. It uses bundled sample data and does not connect to a backend, insurer, or live business systems. Claim changes are stored in the current browser's local storage; they are not shared or sent to a service. Do not enter real claimant or policyholder information.

## Features

- **Claims Dashboard (`/dashboard`)**: filter sample claim metrics by date and claim type, with KPI summaries, charts, and geographic distribution.
- **Claims List (`/claims`)**: search, sort, filter, and page through claims; open a record from its case ID.
- **Claims Board (`/board`)**: view claims by workflow stage in a kanban board.
- **Claim Detail (`/claims/:id`)**: review and update claim status, priority, settlement amount, and adjuster notes; view claim documents and generate a claim PDF, optionally with a browser-generated digital signature.
- Light and dark themes, responsive layouts, and browser-local demo state.

## Technology

| Area | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite |
| Navigation | React Router |
| UI and data visualization | Syncfusion EJ2 React components |
| Icons | Lucide React |
| Sample data | Bundled JSON in `react/public/data/claims.json` |
| PDF | Syncfusion PDF viewer and browser-generated claim PDFs |

## Run locally

Prerequisites: Node.js LTS and npm.

```bash
cd react
npm install
npm run dev
```

Vite serves the development app on port `5173` by default. Open the URL printed in the terminal.

To create and preview a production build:

```bash
npm run build
npm run preview
```

The production build is configured for `/insurance-claims-intake-portal/react/`. Host the built files at that path for the configured base URL and client-side routes to work correctly.

## Configuration

Syncfusion license registration reads `VITE_SYNCFUSION_LICENSE_KEY` at build time. For a licensed local run, create an untracked `.env.local` file in the `react/` directory:

```dotenv
VITE_SYNCFUSION_LICENSE_KEY=your-license-key
```

Without a license key, Syncfusion components may display trial status. Do not commit license keys or other credentials.

## Project structure

```text
react/
+-- public/
|   +-- data/claims.json
|   +-- documents/
|   +-- ej2-pdfviewer-lib/
+-- src/
|   +-- components/   # Shared shell, filters, charts, maps, and PDF viewer
|   +-- domain/       # Claim formatting and visual palette
|   +-- lib/          # Claim data, themes, PDF generation, and signatures
|   +-- pages/        # Dashboard, claims list, board, and claim detail
|   +-- styles/
+-- package.json
+-- server.mjs
+-- vite.config.ts
```

## Checks

Run the TypeScript check and production build from `react/`:

```bash
npm run check
npm run build
```

`npm run test:browser` and `npm run evidence` are also provided for browser checks and evidence capture; each uses its corresponding local configuration or plan file.

## Demo data and privacy

The app loads claim records from the bundled JSON fixture. Supported claim edits are saved in the browser's local storage and can be reset by clearing this app's local storage. They do not update the source fixture or a shared system. The optional digital signature is created in the browser for the generated document; this showcase does not provide production identity verification, key management, authentication, authorization, audit history, or claims processing.
