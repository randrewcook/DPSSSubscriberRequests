# DPSS Subscription Request Management — User Guide

**Version 1.1.0**

---

## Table of Contents

1. [Overview](#overview)
2. [Starting the Application](#starting-the-application)
3. [Getting Started](#getting-started)
4. [Public User Workflow](#public-user-workflow)
5. [Admin User Workflow](#admin-user-workflow)
6. [Common Tasks](#common-tasks)
7. [Troubleshooting](#troubleshooting)
8. [Support](#support)

---

## Overview

The **DPSS Subscription Request Management** application is a secure, web-based platform for managing data hub subscription requests. It provides two distinct user experiences:

- **Public Interface:** For customers to submit new subscription requests or request additional products for existing subscriptions.
- **Admin Interface:** For Itron staff to review, triage, and manage the lifecycle of incoming requests.

### Key Features

- **Two-step request flow:** Subscriber information → Product selection
- **Two subscriber types:** Existing subscribers (with validation) and new subscribers (with registration)
- **Multi-region support:** USA, Canada, Europe, and Australia with environment-specific mappings
- **CAPTCHA protection:** reCAPTCHA v3 guards against abuse on public submissions
- **Secure admin panel:** Token-based authentication with role-based access control
- **Email notifications:** Internal alerts and customer confirmations on submission
- **Request lifecycle management:** Track requests through New → In Review → Complete or Rejected statuses
- **Product exclusions:** Admin-managed ability to hide specific data products from the public catalog

---

## Starting the Application

The application stack runs entirely in Docker inside **WSL2** (Windows Subsystem for Linux 2) without requiring Docker Desktop. The stack includes:

- **PostgreSQL 16** — persistent database (port 5432)
- **Migration runner** — applies DB schema on first start (runs once and exits)
- **Express app** — the web application (port 3012)

### Prerequisites

| Requirement | Check |
|---|---|
| WSL2 installed | `wsl -l -v` should show your distro with VERSION 2 |
| Docker Engine in WSL2 | `wsl -d Ubuntu-20.04 -- docker --version` |
| Docker Compose plugin | `wsl -d Ubuntu-20.04 -- docker compose version` |

The app is configured for the **Ubuntu-20.04** WSL distro. All `docker` commands run inside that distro.

---

### Start the Application

Open a PowerShell or terminal window and run:

```powershell
wsl -d Ubuntu-20.04 -- sh -lc "cd /mnt/c/Users/acook/dpss-subscriber-requests && docker compose up -d"
```

This will:
1. Start the PostgreSQL container and wait until it is healthy
2. Run database migrations (creates tables if they don't exist)
3. Start the Express app on port 3012

**Expected output:**
```
✔ Container dpss-subscriber-requests-db-1       Healthy
✔ Container dpss-subscriber-requests-migrate-1  Exited (0)   ← normal; runs once
✔ Container dpss-subscriber-requests-app-1      Started
```

`migrate-1` exiting with code 0 is expected and correct — it runs once and exits cleanly.

---

### Verify the Application is Running

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3012/health | Select-Object -ExpandProperty Content
```

Expected response: `{"status":"ok"}`

Then open your browser and navigate to:
- **Public UI:** http://localhost:3012
- **Admin UI:** http://localhost:3012/admin

---

### View Running Containers

```powershell
wsl -d Ubuntu-20.04 -- docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
```

Expected output shows `db-1` and `app-1` running:
```
NAMES                             STATUS          PORTS
dpss-subscriber-requests-app-1   Up X seconds    0.0.0.0:3012->3012/tcp
dpss-subscriber-requests-db-1    Up X seconds    0.0.0.0:5432->5432/tcp
```

---

### View Application Logs

**All services:**
```powershell
wsl -d Ubuntu-20.04 -- sh -lc "cd /mnt/c/Users/acook/dpss-subscriber-requests && docker compose logs"
```

**App only (follow/tail):**
```powershell
wsl -d Ubuntu-20.04 -- sh -lc "cd /mnt/c/Users/acook/dpss-subscriber-requests && docker compose logs -f app"
```

**Database only:**
```powershell
wsl -d Ubuntu-20.04 -- sh -lc "cd /mnt/c/Users/acook/dpss-subscriber-requests && docker compose logs db"
```

---

### Stop the Application

**Stop but keep containers (fast restart later):**
```powershell
wsl -d Ubuntu-20.04 -- sh -lc "cd /mnt/c/Users/acook/dpss-subscriber-requests && docker compose stop"
```

**Stop and remove containers (clean shutdown):**
```powershell
wsl -d Ubuntu-20.04 -- sh -lc "cd /mnt/c/Users/acook/dpss-subscriber-requests && docker compose down"
```

> **Note:** `docker compose down` removes containers but **does not delete the PostgreSQL data volume** (`pgdata`). Your database content is preserved across restarts.

**Stop and wipe all data (nuclear reset):**
```powershell
wsl -d Ubuntu-20.04 -- sh -lc "cd /mnt/c/Users/acook/dpss-subscriber-requests && docker compose down -v"
```

> ⚠ The `-v` flag removes the named volume and permanently deletes all database records.

---

### Rebuild After Code Changes

If you've made code changes and need to rebuild the app image:

```powershell
wsl -d Ubuntu-20.04 -- sh -lc "cd /mnt/c/Users/acook/dpss-subscriber-requests && docker compose up -d --build"
```

---

### Start the Local SMTP Catcher

The SMTP catcher captures all outbound emails locally so you can inspect them without sending real messages. It runs on **Windows** (not inside WSL) using Node.js.

```powershell
npm run start:test-smtp
```

**Expected output:**
```
Started local SMTP catcher (pid XXXX)
SMTP: localhost:1025
Inbox UI: http://localhost:8025
```

- **SMTP server:** `localhost:1025` — the app sends emails here (configured via `SMTP_MODE=local` in `.env`)
- **Inbox UI:** http://localhost:8025 — browse captured emails in a web interface

> If the catcher is already running, the command prints `Local SMTP catcher already running` and exits cleanly — it is safe to run multiple times.

**Stop the SMTP catcher:**
```powershell
npm run stop:test-smtp
```

---

### Full Stack Startup Sequence

To start everything from scratch in the correct order:

```powershell
# 1. Start the database + app (WSL2 Docker)
wsl -d Ubuntu-20.04 -- sh -lc "cd /mnt/c/Users/acook/dpss-subscriber-requests && docker compose up -d"

# 2. Start the local SMTP catcher (Windows / Node.js)
npm run start:test-smtp
```

Once both are running, verify:

| Service | URL | Expected |
|---|---|---|
| App health | http://localhost:3012/health | `{"status":"ok"}` |
| Public UI | http://localhost:3012 | Subscription form |
| Admin UI | http://localhost:3012/admin | Admin login |
| Email inbox | http://localhost:8025 | SMTP inbox UI |

**Full stop:**
```powershell
# Stop SMTP catcher
npm run stop:test-smtp

# Stop Docker stack
wsl -d Ubuntu-20.04 -- sh -lc "cd /mnt/c/Users/acook/dpss-subscriber-requests && docker compose down"
```

---

### Check Compose Service Status

```powershell
wsl -d Ubuntu-20.04 -- sh -lc "cd /mnt/c/Users/acook/dpss-subscriber-requests && docker compose ps"
```

---

### Startup Troubleshooting

**WSL is stopped — start it first:**
```powershell
wsl -d Ubuntu-20.04
# Then open a new terminal and run the start command
```

**Docker daemon not running inside WSL:**
```bash
# Run inside WSL (wsl -d Ubuntu-20.04)
sudo service docker start
```

**Port 3012 already in use on Windows:**
```powershell
netstat -ano | findstr :3012
# Find the PID and stop the conflicting process, or change PORT in .env
```

**App container exits immediately after start:**
```powershell
# Check app logs for the error
wsl -d Ubuntu-20.04 -- sh -lc "cd /mnt/c/Users/acook/dpss-subscriber-requests && docker compose logs app"
```

**Database connection refused:**
- Confirm `db-1` container is healthy before `app-1` starts (Compose handles this automatically)
- Check `.env` has `DATABASE_URL=postgres://postgres:postgres@db:5432/dpss_subscriber_requests`
- The `db` hostname resolves only inside the Docker network — do **not** use `localhost` in the containerized `.env`

---

## Getting Started

### Accessing the Application

The application runs on **localhost:3012** when started locally, or on your deployed server URL in production.

#### **For Public Users:**
- Navigate to: `http://localhost:3012` (or your production URL)
- No login required
- All fields are validated in real-time

#### **For Admin Users:**
- Navigate to: `http://localhost:3012/admin` (or your production URL)
- Login required with email and password
- First-time setup: See [Admin Bootstrap](#admin-bootstrap) below

### Browser Requirements

- Modern browser with JavaScript enabled
- Cookies enabled (for session management)
- TLS/HTTPS in production (required for CAPTCHA)

---

## Public User Workflow

### Step 1: Select Subscriber Type

On the public page, you'll see two main options in the **Step 1 — Subscriber Information** section:

#### **Option A: Existing Subscriber**

If you already have a subscription with Itron, select **Existing Subscriber**.

1. **Choose your region:** Select from USA, Canada, Europe, or Australia
2. **Enter your Subscriber ID:** This is a unique identifier (UUID format) provided by Itron
3. **Click "Validate Subscriber"**

The system will:
- Verify your Subscriber ID exists in the DPSS database
- Retrieve your company name, email, and contact details
- Display your current subscription(s) and their status
- Auto-populate read-only fields for your company information

4. **Complete remaining fields:**
   - **Itron Sponsor Name:** The name of your Itron account manager or sponsor
   - **Itron Sponsor Email:** Their email address
5. **Click "Continue to Product Selection"** to proceed to Step 2

**If validation fails:**
- Check that your Subscriber ID is correct and in UUID format (e.g., `12345678-1234-1234-1234-123456789012`)
- Confirm you selected the correct region
- Contact [Support](#support) if the problem persists

---

#### **Option B: New Subscriber**

If you're a new customer, select **New Subscriber**.

1. **Choose your region:** Select from USA, Canada, Europe, or Australia
2. **Fill in all company and contact fields:**
   - **Company Name:** Legal name of your organization
   - **Company Address:** Full mailing address
   - **Phone Number:** Company contact phone
   - **Company Email:** Primary contact email
   - **Developer First Name:** First name of the technical contact
   - **Developer Last Name:** Last name of the technical contact
   - **Itron Sponsor Name:** Your Itron account manager or sponsor name
   - **Itron Sponsor Email:** Their email address

3. **Click "Continue to Product Selection"** to proceed to Step 2

**Validation notes:**
- All fields are required
- Email addresses must be valid (e.g., `user@example.com`)
- Fields are validated as you type; red text indicates an error

---

### Step 2: Product Selection & Submission

Once Step 1 is complete, you'll proceed to **Step 2 — Product Selection**.

#### **Load Data Products**

1. **Click "Load Data Products"**
   - The system fetches the current list of available data products for your region
   - This may take a few seconds

2. **Select the products you need:**
   - Click the checkbox next to each product name
   - **Select All:** Click to quickly check all products
   - **Clear All:** Click to uncheck all products
   - At least one product must be selected

**If no products appear:**
- Confirm your region is correct
- Some regions may have limited product availability
- Contact [Support](#support)

---

#### **Specify Tenant Short Codes**

Tenant short codes identify where your data will be deployed. They're usually environment or location identifiers (e.g., `PROD_US`, `UAT_EU`, `TENANT-A`).

1. **Enter tenant short codes** in the "Tenant Short Codes" field:
   - Type a code and press **Enter** or **Tab** to add it
   - Separate multiple codes with commas
   - Codes appear as "chips" (tags) below the input
2. **Remove codes** by clicking the **×** button on a chip
3. **At least one tenant code is required**

**Tenant code rules:**
- Must start with a letter or number
- Can contain letters, numbers, periods (.), hyphens (-), and underscores (_)
- Invalid codes like `@TENANT` or `-INVALID` are rejected with an error message

---

#### **Submit Your Request**

1. **Review your selections:**
   - Confirm subscriber type and details
   - Verify selected products
   - Check tenant codes

2. **Click "Submit Request"**
   - The system validates your data
   - A CAPTCHA challenge may appear (reCAPTCHA v3)
   - Your submission is encrypted and sent to Itron servers

3. **Request confirmation:**
   - On success, you'll receive a **Reference ID** (e.g., `#12345`)
   - Keep this number for your records
   - Email confirmations are sent to:
     - **Your email:** Acknowledgment that your request was received
     - **Itron internal team:** Alert that a new request needs review

4. **Next steps:**
   - An Itron admin will review your request within 1–2 business days
   - You'll receive an email when the status changes (In Review, Complete, or Rejected)

**If submission fails:**
- Check that all required fields are filled
- Verify your email address is correct
- If CAPTCHA fails, try again or [contact Support](#support)
- See [Troubleshooting](#troubleshooting) for other issues

---

## Admin User Workflow

### Logging In

1. Navigate to `http://localhost:3012/admin`
2. Enter your **Email** and **Password**
3. Click **Login**

**First-time login (Admin Bootstrap):**
- If no admin account exists, an administrator must create the first account via API:
  ```bash
  curl -X POST http://localhost:3012/api/admin/auth/bootstrap \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@itron.com","password":"YourStrongPassword123"}'
  ```
- Password must be at least 12 characters
- After bootstrap, all new admin users must be added by an existing admin (contact your IT administrator)

**Forgotten password:**
- Contact your IT administrator to reset your account
- Passwords are hashed and never logged; admins cannot retrieve them

---

### Admin Queue

Once logged in, you'll see the **Admin Queue** with a list of all open requests.

#### **Filter Requests**

Use the **Status Filter** dropdown to view requests by status:

- **Open (New + In Review):** Recently submitted requests and those currently being reviewed (default)
- **New:** Requests awaiting initial review
- **In Review:** Requests currently being worked on
- **Complete:** Successfully processed requests
- **Rejected:** Requests that were declined

Click **Reload** to refresh the list.

#### **Request List Columns**

| Column | Description |
|--------|-------------|
| **ID** | Unique request identifier |
| **Status** | Current workflow state |
| **Type** | `existing` or `new` (subscriber type) |
| **Submitter** | Customer name or email |
| **Created** | Date and time submitted |
| **Action** | "View" button to open details |

#### **View Request Details**

1. Click the **View** button for any request
2. You'll see:
   - **Request metadata:** ID, status, flow type, region
   - **Subscriber details:** Name, company, email, sponsor info
   - **Product selections:** Data products requested
   - **Tenant mappings:** Tenant codes assigned to each product
   - **Status history:** Complete audit trail of status changes with timestamps and notes

---

### Updating Request Status

From the request detail view, you can change the status and add notes:

1. **Select a new status** from the "Change Status" dropdown:
   - **New:** Reset to initial state (rarely used)
   - **In Review:** Mark as being actively worked
   - **Complete:** Mark as successfully fulfilled
   - **Rejected:** Mark as declined

2. **Add optional notes:**
   - Explain why you're changing the status
   - Notes are visible in the status history
   - Limited to 500 characters

3. **Click "Update Status"**
   - The system records the status change with your email address and timestamp
   - The status history updates immediately

**Status workflow best practice:**
```
New → In Review → Complete
            ↓
          Rejected
```

Requests typically flow New → In Review → Complete, but can be rejected at any stage.

---

### Managing Product Exclusions

Admins can hide specific data products from the public catalog. This is useful for:
- Deprecating old products
- Temporarily hiding products under maintenance
- Restricting access to certain products by region

#### **View Exclusions**

1. (Feature in development—available via API in current release)
2. API endpoint: `GET /api/admin/exclusions`

#### **Exclude a Product**

1. Via API: `POST /api/admin/exclusions`
   ```bash
   curl -X POST http://localhost:3012/api/admin/exclusions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{"dataProductId":"PROD-123","reason":"Under maintenance"}'
   ```
2. Products matching this ID will no longer appear in the public product list

#### **Re-enable an Excluded Product**

1. Via API: `DELETE /api/admin/exclusions/:dataProductId`
   ```bash
   curl -X DELETE http://localhost:3012/api/admin/exclusions/PROD-123 \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

---

### Logging Out

Click the **Logout** button to end your session.
- Your JWT token is cleared from your browser
- You'll be redirected to the login screen
- Your session is invalidated server-side

---

## Common Tasks

### Task 1: Submit a Subscription Request (Existing Subscriber)

**Goal:** Request additional data products for an existing subscription

1. Go to `http://localhost:3012`
2. Select **Existing Subscriber**
3. Choose your region (e.g., USA)
4. Enter your Subscriber ID (provided by Itron)
5. Click **Validate Subscriber**
6. Confirm auto-populated fields and enter sponsor information
7. Click **Continue to Product Selection**
8. Click **Load Data Products**
9. Check the products you need
10. Enter tenant short codes (comma-separated or one per entry)
11. Click **Submit Request**
12. Save your Reference ID
13. Wait for email confirmation

**Time to complete:** 3–5 minutes

---

### Task 2: Submit a Subscription Request (New Subscriber)

**Goal:** Register as a new subscriber and request initial products

1. Go to `http://localhost:3012`
2. Select **New Subscriber**
3. Choose your region
4. Fill in all company and contact information
5. Click **Continue to Product Selection**
6. Click **Load Data Products**
7. Select products you need
8. Enter tenant short codes
9. Click **Submit Request**
10. Save your Reference ID
11. Watch for email confirmation within 1–2 business days

**Time to complete:** 5–10 minutes

---

### Task 3: Review and Triage a Request (Admin)

**Goal:** Review incoming request and assess next steps

1. Log in to `http://localhost:3012/admin`
2. Use the status filter to view **Open** requests
3. Click **View** on a request with status "New"
4. Review all fields:
   - Subscriber type and details
   - Products requested
   - Tenant assignments
5. Decide on next action:
   - **If approved:** Change status to "In Review", add note "Approved for provisioning"
   - **If needs clarification:** Stay "New", add note "Awaiting customer email"
   - **If rejected:** Change to "Rejected", add reason
6. Click **Update Status**

**Time to complete:** 2–5 minutes per request

---

### Task 4: Approve and Complete a Request (Admin)

**Goal:** Mark a request as complete after provisioning

1. Log in to `http://localhost:3012/admin`
2. Filter by status **In Review**
3. Click **View** on the request
4. Once provisioning is done (in external systems):
5. Change status to **Complete**
6. Add note: "Provisioned on 2026-05-06. Account ready." or similar
7. Click **Update Status**
8. ✓ Request is marked complete; status history is logged

**Time to complete:** 1–2 minutes per request

---

### Task 5: Reject a Request (Admin)

**Goal:** Decline a subscription request

1. Log in to `http://localhost:3012/admin`
2. Click **View** on the request
3. Change status to **Rejected**
4. Add a clear reason in notes, e.g.:
   - "Subscriber not verified in system"
   - "Product not available for this region"
   - "Duplicate request (see request #12345)"
5. Click **Update Status**
6. The customer will receive an email notification with your rejection

**Time to complete:** 1–2 minutes per request

---

### Task 6: Audit Request History

**Goal:** View the complete lifecycle of a request

1. Log in to `http://localhost:3012/admin`
2. Click **View** on any request
3. Scroll to **Status History** section
4. See all status changes in chronological order:
   - **Timestamp:** When the change occurred
   - **Old Status → New Status:** What changed
   - **Changed By:** Which admin made the change
   - **Notes:** Any comments added

Example:
```
2026-05-06 14:22:15: null → New (system) - Initial submission
2026-05-06 15:45:32: New → In Review (jane.smith@itron.com) - Approved for provisioning
2026-05-07 10:15:08: In Review → Complete (john.doe@itron.com) - Provisioned; user notified
```

**Time to complete:** 1 minute to review

---

## Troubleshooting

### Issue: "Invalid Subscriber ID" Error

**Cause:** Subscriber ID not found or in wrong format

**Solutions:**
1. Verify the ID is exactly as Itron provided it (case-sensitive)
2. Confirm it's in UUID format: `12345678-1234-1234-1234-123456789012`
3. Make sure you selected the correct region
4. Try removing leading/trailing spaces
5. Contact [Support](#support) if you believe your ID is correct

---

### Issue: "No Existing Subscriptions Found"

**Cause:** Your Subscriber ID is valid, but no prior subscriptions exist

**Why:** You may be a new customer or this is your first request.

**Solution:** This is normal. You can still proceed with the existing subscriber flow. If you believe you should have subscriptions, contact [Support](#support).

---

### Issue: "No Data Products Available"

**Cause:** Products not loading or no products available for your region

**Solutions:**
1. Check your internet connection
2. Ensure you selected a valid region
3. Try clicking "Load Data Products" again
4. If the issue persists, some regions may have limited availability
5. Contact [Support](#support)

---

### Issue: "Invalid Tenant Short Code" Error

**Cause:** Tenant code format is invalid

**Example invalid codes:**
- `@TENANT` (starts with special character)
- `-PROD` (starts with hyphen)
- ` SPACE` (contains spaces)

**Valid examples:**
- `PROD_US` ✓
- `TENANT-A` ✓
- `env.01` ✓
- `T1` ✓

**Solution:** Follow the rules: start with a letter or number, use only letters, numbers, periods, hyphens, and underscores.

---

### Issue: CAPTCHA Fails

**Cause:** reCAPTCHA v3 detected suspicious activity

**Solutions:**
1. Ensure you're not using a VPN or proxy (if your organization allows)
2. Clear browser cookies and try again
3. If you're on a corporate network, ask your IT team to whitelist `www.google.com` and `www.gstatic.com`
4. Try from a different network or device
5. Contact [Support](#support) for manual verification

---

### Issue: Email Confirmation Not Received

**Cause:** Email delivery failed or was filtered

**Solutions:**
1. Check your spam/junk folder
2. Verify the email address you entered is correct
3. Ask your mail administrator to check SMTP logs
4. If you have your Reference ID, you can track the request in the admin panel
5. Contact [Support](#support)

---

### Issue: Admin Login Fails

**Cause:** Incorrect credentials or account not provisioned

**Solutions:**
1. Verify your email address is exact (lowercase)
2. Confirm your password (case-sensitive)
3. If you forgot your password, contact your IT administrator
4. Ask your IT team to verify your admin account exists in the system
5. Try logging out (if logged in another browser) and try again

---

### Issue: Cannot Update Request Status (Admin)

**Cause:** Permission issue, request ID invalid, or session expired

**Solutions:**
1. Check that your JWT token is still valid (try logging out and back in)
2. Verify you selected a valid status from the dropdown
3. Confirm the request exists (try reloading the queue)
4. Check browser console for error messages (F12 → Console tab)
5. Contact [Support](#support) if error persists

---

### Issue: Browser Shows Security Warning

**Cause:** Certificate or HTTPS/CSP issue (production only)

**Solutions:**
1. Confirm you're accessing the correct domain
2. In production, the server must use a valid HTTPS certificate
3. Check that Content Security Policy headers are correct
4. Contact your IT administrator

---

## Support

For questions, issues, or feature requests, contact:

**Phone:** (+1) 509-891-3700

**Email:** andrew.cook@itron.com

**Company:** Itron

**Itron Access Portal:** https://customer.itron.com

---

### When Contacting Support, Please Provide:

- **Request ID** (if applicable): e.g., `#12345`
- **Error message:** Exact text shown on screen
- **Steps to reproduce:** How to trigger the issue
- **Browser & OS:** e.g., Chrome 125 on Windows 11
- **Timestamp:** When the issue occurred (with timezone)

---

## Copyright

© 2026 Itron. All rights reserved.

For licensing and legal information, see the [About](#about) page in the application or contact [Support](#support).

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | 2026-05-06 | Added About Us modal; improved test coverage documentation |
| 1.0.1 | 2026-04-15 | Initial release with public submission and admin queue |

---

**Last Updated:** May 6, 2026

For the latest documentation, visit: `http://localhost:3012` or your production URL.
