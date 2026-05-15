# LiveSite AI Chrome Extension MVP

This is a lightweight Chrome Extension companion for LiveSite AI. It helps a user capture the current prospect page, submit basic demo request details to the LiveSite API, and copy the resulting demo link and outreach message.

The extension is intentionally isolated from the main LiveSite app and API. It does not modify production app code, database schema, migrations, or deployment configuration.

## What It Does

- Reads the current active tab URL and title.
- Prefills the prospect URL and business name when possible.
- Stores API settings in `chrome.storage.local`.
- Calls `POST {API_BASE_URL}/api/v1/demo-requests`.
- Sends the saved API key with the `x-api-key` header.
- Displays the returned demo URL and opens the splash/gate page first.
- Generates a fallback outreach message if the API does not return one.
- Lets the user copy the demo URL, copy outreach text, or open the demo.

## What It Does Not Do

- It does not scrape Facebook.
- It does not send DMs.
- It does not collect cookies.
- It does not inject scripts into prospect pages.
- It does not track browser activity.
- It does not store prospect history.
- It does not automate outreach.

## Load In Chrome

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the `chrome-extension-mvp` folder.
5. Pin the LiveSite AI Demo Builder extension if desired.

## Configure

Open the extension popup and set:

- `API Base URL`: defaults to `https://livesite-ai-api-code.vercel.app`. A full `/api/v1/demo-requests` endpoint is also accepted.
- `API Key`: paste the raw `lsi_` API key. The extension sends it as `x-api-key`.
- `Default Chat Widget ID`: optional GHL chat widget ID to include in the request metadata.
- `GHL Location ID`: required by the current LiveSite `POST /api/v1/demo-requests` endpoint.
- `Source Type` and `Offer Type`: saved as your last selected defaults.

Settings are stored with `chrome.storage.local`.

## Test

1. Visit a business website, Facebook page, LinkedIn company page, Yelp listing, or directory page.
2. Open the extension.
3. Confirm the business name and current page URL.
4. Add a website URL if the current page is a listing rather than the business website.
5. Confirm API settings.
6. Click `Create Demo`.
7. Copy the demo URL or outreach message.
8. Open the demo in a new tab.

## API Notes

The existing LiveSite route is:

```text
POST /api/v1/demo-requests
```

It currently expects the core fields:

```json
{
  "companyName": "Example Business",
  "websiteUrl": "https://example.com",
  "locationId": "GHL_LOCATION_ID",
  "source": "chrome_extension"
}
```

The extension also includes the MVP request metadata in `rawPayload`:

```json
{
  "source_url": "https://example.com",
  "website_url": "https://example.com",
  "business_name": "Example Business",
  "source_type": "website",
  "offer_type": "speed_to_lead_demo",
  "created_from": "chrome_extension",
  "chat_widget_id": "USER_SAVED_WIDGET_ID"
}
```

## Known Limitations

- The extension does not scrape Facebook.
- The extension does not send DMs.
- The extension does not automatically create GoHighLevel contacts yet.
- The extension does not store prospect history yet.
- The extension requires a working LiveSite API endpoint.
- The extension currently uses a raw chat widget ID instead of user-friendly saved demo templates.
- The extension currently relies on the active tab title and URL for prefill.
- The current API requires a GHL Location ID.
- Host permissions are limited to Vercel, LiveSite AI domains, localhost, and 127.0.0.1. Add a custom API domain to `manifest.json` if needed.

## Future Features

- Prospect history
- Saved prospects
- Demo viewed alerts
- GoHighLevel contact creation
- GoHighLevel pipeline movement
- Saved outreach templates
- Team accounts
- User login
- CRM notes
- Follow-up reminders
- Source-specific parsing
- Better business-name detection
- Optional website extraction from Facebook page when safely available
- Demo analytics inside the extension
- Multiple saved demo agents
- Multiple saved chat widget IDs
- Demo template selection
- Agent config selection
- Branding presets
- Industry-specific demo presets

## Longer-Term Architecture Note

The MVP sends `chat_widget_id` as request metadata. Over time, LiveSite should probably expose user-owned `demo_template_id` or `agent_config_id` options so the extension can show friendly choices such as `General Website Chat Demo` or `HVAC Speed-to-Lead Demo` instead of requiring raw widget IDs.
