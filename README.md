# VANTA

VANTA is a static endpoint checker with an optional persistent monitoring service.

## Permanent monitoring

Set a private admin token before starting the app. It must be at least 24 characters; generate one with `openssl rand -hex 32`. Export it as `VANTA_ADMIN_TOKEN`, then run `docker compose up --build` and open [http://localhost:8081](http://localhost:8081). Enter the same token in the monitoring form along with an HTTP or HTTPS URL and a Discord webhook URL. The server checks each saved endpoint every two minutes and sends a Discord alert only when a previously established up/down status changes. The monitor list refreshes every 30 seconds. Monitor data is stored in the `vanta-data` Docker volume and survives container restarts.

The monitoring API requires this token for listing, adding, and deleting monitors. Monitor targets must resolve exclusively to public internet addresses; local/private addresses and redirects to them are rejected. The service allows up to 100 monitors and 10 creation attempts per IP address per hour. For local development, set `ADMIN_TOKEN` directly before starting the service.

To create a webhook, open **Discord server settings → Integrations → Webhooks → New Webhook → Copy Webhook URL**, then paste the copied URL into VANTA.

For local development, install the service dependencies with `npm --prefix server install`, set `ADMIN_TOKEN` to a private random value of at least 24 characters, then run `npm --prefix server start`. The service uses `server/data/vanta.sqlite` locally by default; set `DATA_DIR` to use another data directory or `PORT` to change its listening port.
