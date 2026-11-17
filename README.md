# TECHNOVATION 2026 — 3.0

Usman Public School System’s student innovation exhibition. Staff register students and projects, choose when to share them, and print labels. Visitors open individual project pages by scanning the labels with a phone camera.

## Run locally

Install Node.js 22.12+ and have a PostgreSQL database available. For a local database with Docker Compose, use the supplied Compose file.

1. Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell).
2. Set `DATABASE_URL` to your PostgreSQL connection string. For Compose, set `POSTGRES_PASSWORD` to a private password and put the same password in `DATABASE_URL` (URL encode special characters in that URL).
3. Use `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to generate the value for `APP_SECRET`.
4. Set `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` (at least 14 characters) and optionally `BOOTSTRAP_ADMIN_NAME`.
5. If using the optional Compose database, run `docker compose up -d --wait postgres`.
6. Run the commands below from this folder, in order.

```sh
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm start
```

Open `http://localhost:3000` and use **Staff sign in** with the configured administrator account. The initial database seeds the categories and settings. Students and projects are added from the staff workspace. Remove the bootstrap password from `.env` once the account exists. Re-running the seed leaves existing accounts unchanged.

For development, `npm run dev` restarts the application on file changes. If your package manager blocks Prisma install hooks, `npm run db:generate` explicitly produces the client. Package installation and Prisma engine download require internet access.

## Exhibition workflow

1. Add students in **Students** and record consent for sharing the name or photo on QR project pages.
2. In **Students → Project teams**, select **Create team** and choose a lead student. Leave additional members blank for a solo project. Save to register the project and create its QR code. For group projects imported by CSV, add teammates in the optional `memberIds` column and separate multiple IDs with `|`.
3. Open the team and designate one member under **Student editor**. Set the editor’s email and password and share them privately. The editor signs in at `/student/login` and can enter project details and upload media for that project while QR sharing is off. Staff can preview the work and enable QR sharing when every team member has recorded consent.
4. In **QR labels**, download a PNG or print a label. Visitors can open a shared project using their phones’ camera apps. Turning off sharing preserves the label for reuse. Replacing the code invalidates the previous label.
5. Download the branded PDF or CSV project register and lead-student participation certificates from **Reports**.

## Scan from a phone

For a local exhibition preview, set `LAN_QR_HOST` to the computer’s Wi-Fi IPv4 address, keep `HOST=127.0.0.1`, and restart the app. This starts a separate visitor-only listener on the Wi-Fi address and uses that address in generated QR labels. Connect the phone to the same Wi-Fi. Print a new label if the computer’s address changes. The staff workspace remains on the local computer in this mode.

For a temporary HTTPS preview across networks, point the proxy at the visitor-only listener and set `QR_PUBLIC_ORIGIN` to the HTTPS address provided by the proxy. Reprint the labels after changing the URL.

Students sign in through the full application. Host it over HTTPS for students to edit from their own devices. A static Cloudflare Pages export displays shared visitor pages.

## Deployment and storage

- Apply the migration and seed during initial deployment. Later releases apply migrations before starting the server. Configure HTTPS with `NODE_ENV=production`, set `PUBLIC_ORIGIN` to the exhibition’s public HTTPS URL, and set `HOST` to the container or private network binding as appropriate. Use `TRUST_PROXY` only for the actual trusted reverse-proxy hop count.
- Production QR links use `PUBLIC_ORIGIN`. Set it to the permanent HTTPS address before printing labels.
- Mount `UPLOAD_DIRECTORY` on persistent private storage and include its contents in database backups. Use a single app instance unless the upload directory is shared and rate limits are enforced centrally at the reverse proxy. Use a separately configured PostgreSQL service in production.
- Store `APP_SECRET` in your deployment’s secret store and retain it across restarts. Existing QR labels need to be regenerated after rotating this key. The secret and database credentials belong in deployment configuration.
- The readiness endpoint is `/healthz`. It checks the database and migrated settings table.
- Publish material with school approval. Use the admin publishing controls to manage public visibility, and keep production logs, database backups and uploads within school-controlled infrastructure.

## Brand sources

The bundled wordmark is the school website’s own unmodified PNG. The compact emblem uses an undistorted crop of the school’s official anthem artwork. Administrators can upload a transparent PNG or SVG logo from **Settings**. The server renders an uploaded SVG to PNG so it can appear on the website and in printed PDFs.

- [Usman Public School System wordmark](https://usman.edu.pk/resources/images/new_logo.png)
- [Official anthem artwork](https://soundcloud.com/usmanschool/usmanian-hain-hum-upss-official-anthem)
- [School core values](https://www.usman.edu.pk/about)

TECHNOVATION’s educational mission and vision come from the exhibition brief. The school section presents the institution’s six core values in plain language. The homepage rover photograph was made with built-in ImageGen and saved at `frontend/public/assets/technovation-rover.webp`. The prompt called for editorial photography of a student-built rover with a navy frame, visible electronics and aluminum sensor mounts.
