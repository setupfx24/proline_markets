# Proline Markets Admin (Next.js)

## Run locally

```bash
cd frontend/admin
npm install
npm run dev
```

Open **http://localhost:3001** (not plain `localhost` unless your browser defaults to 3001).

Set `NEXT_PUBLIC_API_URL` if the admin API is not at `http://localhost:8001`.

## White screen + `500` on `/_next/static/chunks/...`

That means the **Next dev server** is broken or a **stale process** is still bound to port **3001** (often after deleting `.next` while `npm run dev` was running).

**Fix (macOS/Linux):**

1. Stop all dev servers (Ctrl+C in the terminal that runs Next).
2. Free the port and clear the cache:

   ```bash
   lsof -i :3001   # note the PID in the LISTEN row
   kill <PID>      # replace with that number
   cd frontend/admin && rm -rf .next && npm run dev
   ```

   Or in one go after install:

   ```bash
   npm run dev:clean
   ```

   (If you still get `EADDRINUSE`, kill the PID from `lsof -i :3001` first.)

3. Hard refresh the browser (empty cache if needed).

After a healthy start, `curl -I http://localhost:3001/` should be **200**, and chunk URLs under `/_next/static/` should load (not 500).
