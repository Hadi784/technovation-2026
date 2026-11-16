# Exhibition operations

## Database and backups

Staff accounts, students, project teams, projects, uploads, QR labels and audit records are stored in PostgreSQL. Project teams link registered students to projects. Older evaluation records are retained in the database. The service creates missing QR labels for existing projects on startup.

Treat the database and files in `UPLOAD_DIRECTORY` as one backup set. On a running exhibition server, pause writes or take coordinated snapshots so uploaded file references and database rows match. Restore to a separate environment first and check sign-in, the count of registered projects, and a sample media file.

Uploaded project files require a QR link for the project, or staff sign-in. Disabling or replacing the code closes access to its detail page and attachments. Withdrawn attachments are detached from the project. Files without a current link remain in the private upload directory until handled under the school's data retention process. Keep any off-site copies private.

## Before the exhibition opens

1. Confirm `/healthz` is healthy and the administrator can sign in. Keep registration private until the school has approved which student records and project materials may appear publicly.
2. For a live deployment, set `PUBLIC_ORIGIN` to the final HTTPS site address before printing labels. For a same-Wi-Fi preview, set `LAN_QR_HOST` to the computer’s Wi-Fi IPv4 address.
3. Preview one project as staff, turn on sharing, and scan a printed label with a phone. Check the project title, team and media.
4. Print ready labels from **QR labels** and place them at their project stands.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Database unavailable | Confirm the database is reachable from the Node process, `DATABASE_URL` selects the intended database, and `npm run db:migrate` completed. |
| Printed code opens the wrong address | Check `PUBLIC_ORIGIN` or `LAN_QR_HOST`, then download and print the label again. |
| Phone cannot connect to the preview | Connect to the same Wi-Fi. Confirm the phone can open the visitor address and that the network allows device-to-device connections. |
| Label shows an unavailable page | Confirm sharing is on, the code is active, and consent is recorded for everyone on the team. Reprint if the code was replaced. |
