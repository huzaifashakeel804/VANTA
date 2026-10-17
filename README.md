# VANTA

VANTA is a static endpoint checker with an optional persistent monitoring service.

## Permanent monitoring

Run the app with Docker Compose using `docker compose up --build`, then open [http://localhost:8081](http://localhost:8081). Add an HTTP or HTTPS URL and a Discord webhook URL in **Set up permanent monitoring**. The server checks each saved endpoint every two minutes and sends a Discord alert only when a previously established up/down status changes. The monitor list refreshes every 30 seconds. Monitor data is stored in the `vanta-data` Docker volume and survives container restarts.

To create a webhook, open **Discord server settings → Integrations → Webhooks → New Webhook → Copy Webhook URL**, then paste the copied URL into VANTA.

For local development, install the service dependencies with `npm --prefix server install`, then run `npm --prefix server start`. The service uses `server/data/vanta.sqlite` locally by default; set `DATA_DIR` to use another data directory or `PORT` to change its listening port.
