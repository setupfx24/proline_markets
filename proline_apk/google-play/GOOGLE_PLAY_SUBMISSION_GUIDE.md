# Complete Google Play Store Submission Guide for prolinemarkets

## Prerequisites

- [x] Google Play Developer Account ($25 one-time fee) - https://play.google.com/console
- [ ] AAB (Android App Bundle) file - NOT APK
- [ ] Privacy Policy hosted on a public URL
- [ ] Account Deletion Policy hosted on a public URL
- [ ] Terms of Service hosted on a public URL
- [ ] App Icon (512x512 PNG)
- [ ] Feature Graphic (1024x500 PNG/JPG)
- [ ] At least 2 phone screenshots (1080x1920 recommended)

---

## STEP 1: Build AAB for Google Play

**IMPORTANT: Google Play requires AAB format, NOT APK.**

Run this command to build the production AAB:

```bash
cd /path/to/setupfx_mobile_app
eas build --platform android --profile production
```

This uses the `production` profile from eas.json which:

- Builds AAB format (default for production)
- Uses `channel: "production"` for OTA updates
- Auto-increments version code

After the build completes, download the `.aab` file from the EAS dashboard.

---

## STEP 2: Host Policy Pages

Upload these HTML files to your server so they're publicly accessible:

1. **Privacy Policy** → `privacy-policy.html`
   - Host at: `https://prolinemarkets.com/privacy-policy`
2. **Terms of Service** → `terms-of-service.html`
   - Host at: `https://prolinemarkets.com/terms-of-service`

3. **Account Deletion Policy** → `account-deletion-policy.html`
   - Host at: `https://prolinemarkets.com/account-deletion`

### How to host on your server:

```bash
# Copy HTML files to frontend public directory
cp privacy-policy.html ~/prolinemarkets/frontend/public/privacy-policy.html
cp terms-of-service.html ~/prolinemarkets/frontend/public/terms-of-service.html
cp account-deletion-policy.html ~/prolinemarkets/frontend/public/account-deletion.html

# Rebuild frontend
cd ~/prolinemarkets/frontend
npm run build
```

---

## STEP 3: Prepare Graphic Assets

### App Icon (512x512)

- Use `assets/Setupfx app icon.png`
- Resize to exactly 512x512 pixels if not already
- Must be PNG, 32-bit with alpha channel

### Feature Graphic (1024x500) — REQUIRED

- Create using Canva (https://canva.com) or Figma
- Should show: App name "prolinemarkets", trading theme, professional look
- Dimensions: exactly 1024 x 500 pixels
- JPG or PNG format

### Screenshots (minimum 2, recommended 4-8)

- Take screenshots from the app on a real device or emulator
- Dimensions: 1080 x 1920 pixels (portrait)
- Recommended screens to capture:
  1. Trading screen with live prices and chart
  2. Market watchlist with instruments
  3. Open positions showing P&L
  4. Wallet screen with deposit options
  5. Trade history
  6. Dark mode view
  7. Light mode view

---

## STEP 4: Google Play Console Setup

### 4.1 Create App

1. Go to https://play.google.com/console
2. Click "Create app"
3. Fill in:
   - **App name:** prolinemarkets - Trading Platform
   - **Default language:** English (United States)
   - **App or game:** App
   - **Free or paid:** Free
4. Accept declarations and click "Create app"

### 4.2 Store Listing (Main store listing)

Fill in these fields:

**App name:** prolinemarkets - Trading Platform

**Short description:**

```
Trade Forex, Commodities, Indices & Crypto with real-time market data.
```

**Full description:** (Copy from store-listing.md)

**App icon:** Upload 512x512 icon
**Feature graphic:** Upload 1024x500 graphic
**Phone screenshots:** Upload 4-8 screenshots

### 4.3 App Content (Content & Compliance)

#### Content Rating

1. Go to "Content rating" section
2. Start the questionnaire
3. Select category: **Finance**
4. Answer questions:
   - Does the app contain simulated gambling? **Yes** (trading is considered simulated gambling by Google)
   - Does the app contain user-generated content? **No**
   - Does the app contain violence? **No**
   - Does the app contain sexual content? **No**
5. This will likely result in a **PEGI 18 / Mature 17+** rating

#### Privacy Policy

- Enter URL: `https://prolinemarkets.com/privacy-policy`

#### Data Safety

Fill out using the answers in `data-safety.md`:

1. Does your app collect or share data? → **Yes**
2. Is all data encrypted in transit? → **Yes**
3. Can users request data deletion? → **Yes**
4. Follow the data types table in data-safety.md for each category

#### Account Deletion

- Enter URL: `https://prolinemarkets.com/account-deletion`
- Confirm that users can request account deletion

#### Ads

- Does your app contain ads? → **No**

#### Target Audience

- Target age group: **18 and over only**
- Is the app directed at children? → **No**

#### Financial Features Declaration

Since this is a trading app, Google may ask:

- Does your app provide financial trading services? → **Yes**
- Provide any required financial licenses or disclaimers

### 4.4 App Access (if app requires login)

1. Go to "App access" section
2. Select "All or some functionality is restricted"
3. Add instructions for reviewers:
   - **Login required:** Yes
   - Provide test credentials:
     ```
     Email: demo@demo.com
     Password: [create a demo account password]
     ```
4. Add notes: "Create account with any email, or use provided test credentials. KYC verification can be bypassed for testing."

### 4.5 Pricing & Distribution

- **Price:** Free
- **Countries:** Select all countries or specific ones you want to target

---

## STEP 5: Upload AAB & Create Release

### 5.1 Testing Track (Recommended First)

1. Go to "Testing" → "Internal testing"
2. Click "Create new release"
3. Upload the `.aab` file
4. Add release notes:
   ```
   Initial release of prolinemarkets Trading Platform
   - Real-time market data for Forex, Commodities, Indices, and Crypto
   - Execute market and pending orders
   - Secure wallet with multiple payment methods
   - KYC identity verification
   - Dark and Light mode support
   ```
5. Review and roll out to internal testers

### 5.2 Production Release

1. After testing, go to "Production"
2. Click "Create new release"
3. Upload the same `.aab` file
4. Add release notes (same as above)
5. Review and submit for review

---

## STEP 6: OTA Updates After Publishing

Your app is configured for OTA updates via Expo. After publishing to Play Store:

### Push an OTA update (no new AAB needed):

```bash
cd /path/to/setupfx_mobile_app
eas update --channel production --message "Bug fixes and improvements"
```

### When you need a new AAB (native code changes):

```bash
eas build --platform android --profile production
```

Then upload the new AAB to Play Console.

### OTA vs Store Update:

| Change Type                       | Method                    |
| --------------------------------- | ------------------------- |
| JS/React code changes             | OTA update (`eas update`) |
| New npm packages with native code | New AAB build             |
| app.json config changes           | New AAB build             |
| Asset changes (images, fonts)     | OTA update                |
| SDK version upgrade               | New AAB build             |

---

## Common Rejection Reasons & How to Avoid

1. **Missing Privacy Policy** → ✅ Created and needs to be hosted
2. **Missing Account Deletion** → ✅ Created and needs to be hosted
3. **Financial app without disclaimer** → ✅ Risk disclaimer included in description and Terms
4. **No test credentials for reviewers** → Create a demo account for Google reviewers
5. **Broken functionality** → Test thoroughly before submitting
6. **Misleading description** → Description accurately reflects app features
7. **Missing content rating** → Complete the content rating questionnaire
8. **Target audience issues** → Set to 18+ only (trading app)

---

## Checklist Before Submission

- [ ] AAB file built with `eas build --platform android --profile production`
- [ ] Privacy Policy hosted at public URL
- [ ] Terms of Service hosted at public URL
- [ ] Account Deletion Policy hosted at public URL
- [ ] App icon (512x512) ready
- [ ] Feature graphic (1024x500) created
- [ ] At least 4 phone screenshots captured
- [ ] Store listing filled (name, short desc, full desc)
- [ ] Content rating questionnaire completed
- [ ] Data safety form filled
- [ ] App access instructions with test credentials provided
- [ ] Target audience set to 18+
- [ ] Risk disclaimer included
- [ ] Tested on multiple devices
