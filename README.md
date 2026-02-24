
  # UI/UX Structure Enhancement

  This is a code bundle for UI/UX Structure Enhancement. The original project is available at https://www.figma.com/design/WjxvjXNuFweVSxoHZ6PNBJ/UI-UX-Structure-Enhancement.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Deployed Frontend -> Local Backend

  1. Start local backend stack:
     - `docker compose up -d api db redis minio sms worker beat`
  2. Expose local API to internet (example: cloudflared):
     - `cloudflared tunnel --url http://localhost:80`
     - Copy issued `https://<random>.trycloudflare.com` URL.
  3. Open deployed frontend with runtime API override:
     - `https://<deployed-frontend>/neuro-shield/?apiBase=https://<random>.trycloudflare.com`
  4. CORS for deployed domain:
     - set `CORS_ORIGINS` in `.env`, for example:
       - `CORS_ORIGINS=["https://<deployed-frontend-domain>"]`
     - then restart API container: `docker compose up -d --build api`

  Runtime API override priority:
  - query string `apiBase`
  - browser `localStorage["neuro_shield_api_base"]`
  - build variable `VITE_API_BASE_URL`
  
