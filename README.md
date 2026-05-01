# TrueConnect Admin Backend

Small local Node backend for:

- sending Firebase Cloud Messaging notifications from the admin website
- creating, listing, enabling, and disabling VIP coupons in Supabase
- monitoring low trust users and AI risk alerts

## Setup

1. Install Node.js if `npm` is not available in terminal.
2. Download Firebase service account JSON from Firebase Console.
3. Save it as `firebase-service-account.json` in this folder.
4. Add environment variables before starting the server:

```powershell
$env:SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
```

5. Run:

```bash
npm install
npm start
```

Expected output:

```text
Server running on http://localhost:4000
```

## Notification Endpoints

`POST /send-support-reply-notification`

```json
{
  "fcmToken": "USER_FCM_TOKEN",
  "subject": "Unable to login"
}
```

The Android app opens `MyTicketsActivity` when notification data contains `type=support_reply`.

`POST /send-message-notification`

`POST /send-match-notification`

## VIP Coupon Endpoints

`GET /vip-coupons`

Lists all coupons from Supabase.

`POST /vip-coupons`

```json
{
  "code": "TRUEVIP2026",
  "expiresInDays": 90
}
```

Creates or updates a coupon.

`POST /vip-coupons/:code/disable`

Disables a coupon.

`POST /vip-coupons/:code/enable`

Re-enables a coupon.

## Admin Panel Helper

Use [admin-vip-coupon-snippet.js](C:/Users/paras/AndroidStudioProjects/TrueConnect3/backend/admin-backend/admin-vip-coupon-snippet.js) in the admin website for quick coupon management calls.
Use [admin-trust-tools-snippet.js](C:/Users/paras/AndroidStudioProjects/TrueConnect3/backend/admin-backend/admin-trust-tools-snippet.js) for low-trust users, AI alerts, review, and ban actions.

You can also open [trust-monitor.html](C:/Users/paras/AndroidStudioProjects/TrueConnect3/backend/admin-backend/trust-monitor.html) for a ready-made moderation dashboard powered by the backend trust routes.
