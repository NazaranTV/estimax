# Estimax iOS App - Complete Setup Guide

## Important: Mac Computer Required ⚠️

**To build and install the iOS app, you will need access to a Mac computer with Xcode.**

Apple requires all iOS apps to be built using Xcode, which only runs on macOS. There is no official way to build iOS apps on Windows or Linux.

## Options Without a Mac

If you don't have a Mac, here are your alternatives:

### Option 1: Use a Cloud Mac Service (Recommended)
- **MacStadium** - https://www.macstadium.com
- **MacinCloud** - https://www.macincloud.com
- **AWS Mac Instances** - https://aws.amazon.com/ec2/instance-types/mac/

These services rent you access to a Mac in the cloud for $20-50/month. You can:
- Connect remotely via VNC/Remote Desktop
- Install Xcode and build your app
- Cancel the subscription once your app is built

### Option 2: Borrow a Friend's Mac
- You only need the Mac for initial setup and builds
- Once the app is on your iPhone, you don't need the Mac anymore
- Updates will require Mac access again

### Option 3: Use PWA Instead (No Mac Needed)
If you just want app-like experience on iPhone without App Store distribution:

1. **Open Safari on your iPhone**
2. **Navigate to your Estimax website**
3. **Tap the Share button** (square with arrow)
4. **Scroll down and tap "Add to Home Screen"**
5. **Name it "Estimax" and tap Add**

This creates an icon on your home screen that opens Estimax in full-screen mode (like an app). No Mac required!

**PWA Limitations:**
- Can't distribute via App Store
- Slightly less native feel
- No access to some native features

---

## Full Setup Guide (Requires Mac)

### Prerequisites

- **Mac computer** running macOS 12.0 or later
- **Xcode 14.0+** (free from App Store)
- **iPhone** running iOS 15.0+
- **Apple ID** (free account works for personal testing)
- **USB cable** to connect iPhone to Mac

### Step 1: Install Xcode

1. Open the **App Store** on your Mac
2. Search for **"Xcode"**
3. Click **Get** and install (it's large, ~10GB, may take a while)
4. Open Xcode once installed
5. Accept the license agreement
6. Install additional components if prompted

### Step 2: Copy iOS App to Your Mac

The iOS app files are in the `ios-app/EstimaxApp/` folder of your Estimax repository.

**Option A: Copy via USB/Network**
- Copy the entire `ios-app` folder to your Mac
- You can use AirDrop, USB drive, or file sharing

**Option B: Clone the Git Repository**
```bash
git clone <your-repository-url>
cd estimax/ios-app/EstimaxApp
```

### Step 3: Open Project in Xcode

1. Navigate to the copied `ios-app/EstimaxApp/` folder
2. **Double-click** on `EstimaxApp.xcodeproj`
3. Xcode will open with your project

### Step 4: Configure Server URL

**CRITICAL: You must change the server URL to access your Estimax server**

1. In Xcode's left sidebar, click on **ContentView.swift**
2. Find line 14 with `let serverURL = "http://localhost:3000"`
3. Change it to your server's URL:

```swift
// Option 1: Use your server's public URL (if hosted online)
let serverURL = "https://estimax.yourdomain.com"

// Option 2: Use your computer's local IP address (for testing)
let serverURL = "http://192.168.1.100:3000"
```

**Finding Your Computer's IP Address:**

**On Windows:**
```bash
ipconfig
# Look for "IPv4 Address" under your network adapter
```

**On Linux:**
```bash
ip addr show
# Or
hostname -I
```

**On Mac:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Your IP will be something like `192.168.1.100` or `10.0.0.5`

**Important:** Your iPhone must be on the **same Wi-Fi network** as your server for local IP to work.

### Step 5: Configure App Signing

1. In Xcode, click on **EstimaxApp** (the blue icon at the top of the left sidebar)
2. Make sure **EstimaxApp** target is selected (under "Targets")
3. Click the **Signing & Capabilities** tab
4. Check the box for **Automatically manage signing**
5. Select your **Team** from the dropdown:
   - If you see "Add an Account...", click it
   - Sign in with your Apple ID
   - Select the team (it will be your name)
6. Change the **Bundle Identifier** to make it unique:
   - Default is `com.estimax.EstimaxApp`
   - Change to `com.yourname.estimax` or similar
   - Must be unique across all App Store apps

### Step 6: Test on Simulator (Optional)

Before installing on your iPhone, you can test in the simulator:

1. At the top of Xcode, click the device dropdown (says "Any iOS Device")
2. Select a simulator like **iPhone 14 Pro**
3. Click the **Play button** (▶) or press `Cmd + R`
4. Wait for the build to complete
5. The simulator will launch and run your app

**Note:** Simulator uses `localhost`, so make sure your server is running on the Mac.

### Step 7: Install on Your iPhone

#### Connect Your iPhone

1. **Plug your iPhone into your Mac** using a USB cable
2. **Unlock your iPhone**
3. If prompted on iPhone, tap **Trust This Computer**
4. Enter your iPhone passcode

#### Select Your Device

1. In Xcode, click the device dropdown at the top
2. You should see your iPhone listed (e.g., "John's iPhone")
3. **Select your iPhone**

#### Build and Run

1. Click the **Play button** (▶) or press `Cmd + R`
2. Xcode will:
   - Build the app
   - Sign it with your developer certificate
   - Install it on your iPhone
   - Launch it automatically

#### Trust Developer Certificate (First Time Only)

The first time you install an app with your personal Apple ID, you'll need to trust it:

1. On your iPhone, the app will try to open but show a security warning
2. Go to **Settings > General > VPN & Device Management**
3. Under **Developer App**, tap your Apple ID
4. Tap **Trust "[Your Name]"**
5. Confirm by tapping **Trust** again
6. Go back to home screen and open the Estimax app

**It should now work!** 🎉

### Step 8: Make Your Server Accessible to iPhone

Your iPhone needs to be able to reach your Estimax server:

#### Option 1: Same Wi-Fi Network (For Testing)

1. Make sure your server is running
2. Use your server computer's local IP (e.g., `http://192.168.1.100:3000`)
3. Make sure your firewall allows connections on port 3000
4. iPhone must be on same Wi-Fi network

**Test:** Open Safari on iPhone and navigate to your server URL. If it loads, the app will work.

#### Option 2: Public Domain (For Production)

1. Host your Estimax server online (DigitalOcean, AWS, etc.)
2. Set up a domain name (e.g., `estimax.yourdomain.com`)
3. Install SSL certificate (required for HTTPS)
4. Use `https://estimax.yourdomain.com` as your server URL

---

## Distribution Options

### Option 1: Personal Use (Free)

Your current setup works for personal use:
- App stays installed on your iPhone
- Lasts for 7 days, then needs to be re-installed via Xcode
- Free Apple ID is sufficient

**To reinstall after 7 days:**
- Connect iPhone to Mac
- Open Xcode project
- Click Play button to rebuild and install

### Option 2: TestFlight (Free, Better for Testing)

TestFlight lets you distribute to up to 10,000 testers, and apps last 90 days.

**Requirements:**
- Free Apple Developer account
- App uploaded to App Store Connect

**Steps:**

1. **Enroll in Apple Developer Program (Optional but Recommended)**
   - Go to https://developer.apple.com/programs/
   - Costs $99/year
   - Required for App Store submission
   - TestFlight works with free account too

2. **Archive Your App**
   - In Xcode, select **Any iOS Device** from device dropdown
   - Go to **Product > Archive**
   - Wait for archive to complete
   - Archive window will open

3. **Upload to App Store Connect**
   - Click **Distribute App**
   - Select **App Store Connect**
   - Follow the prompts
   - Upload will take several minutes

4. **Configure in App Store Connect**
   - Go to https://appstoreconnect.apple.com
   - Select your app
   - Go to **TestFlight** tab
   - Add yourself as an internal tester
   - Wait for processing (can take 15-30 minutes)

5. **Install via TestFlight**
   - Install **TestFlight** app from App Store on your iPhone
   - Open the email invitation or link
   - Tap **Accept**
   - Tap **Install**
   - App will be installed and lasts 90 days

**Advantages:**
- Apps last 90 days instead of 7
- No Mac needed for installation
- Can share with up to 10,000 testers
- Updates are easy (just upload new build)

### Option 3: App Store (Public Release)

To publish on the App Store:

1. **Complete TestFlight setup first**
2. **Prepare App Store Listing**
   - Screenshots (required)
   - App description
   - Keywords
   - Privacy policy URL
   - Support URL
3. **Submit for Review**
   - In App Store Connect, go to your app
   - Click **Prepare for Submission**
   - Fill in all required information
   - Click **Submit for Review**
4. **Wait for Review** (typically 1-3 days)
5. **Publish** once approved

**Apple's Requirements:**
- App must provide value beyond just wrapping a website
- Must have unique features or functionality
- May require additional native features to be approved

---

## Customization

### Change App Name

1. In Xcode, select the project
2. Select the **EstimaxApp** target
3. Under **General** tab, change **Display Name**
4. Or edit `Info.plist` and change `CFBundleDisplayName`

### Add App Icon

1. Create app icons using a tool like:
   - https://appicon.co (free)
   - https://www.canva.com (has app icon template)
2. You'll need icons in multiple sizes:
   - 20x20, 29x29, 40x40, 60x60, 76x76, 83.5x83.5, 1024x1024 (all @2x and @3x)
3. In Xcode:
   - Click on **Assets.xcassets** in the left sidebar
   - Click on **AppIcon**
   - Drag each icon to its corresponding slot
   - Or use the tool above which generates all sizes

### Change Colors/Theme

The app uses your website's styling. To customize the app wrapper:

1. Edit `ContentView.swift` for layout changes
2. Edit `WebView.swift` for WebView behavior
3. Colors will come from your CSS files

### Add Native Features

You can extend the app with native iOS features:

**Push Notifications:**
```swift
import UserNotifications

// Request permission
UNUserNotificationCenter.current().requestAuthorization(...)
```

**Camera Access:**
```swift
import AVFoundation

// Already configured in Info.plist
// Access via HTML <input type="file" accept="image/*" capture="camera">
```

**Face ID / Touch ID:**
```swift
import LocalAuthentication

let context = LAContext()
context.evaluatePolicy(.deviceOwnerAuthentication, ...)
```

---

## Troubleshooting

### "Could not connect to server"

**Problem:** App shows blank screen or error

**Solutions:**
1. Verify server is running: `curl http://YOUR_SERVER_URL`
2. Check server URL in ContentView.swift is correct
3. Make sure iPhone is on same Wi-Fi network (if using local IP)
4. Test URL in Safari on iPhone first
5. Check firewall allows connections on port 3000
6. For HTTPS, make sure SSL certificate is valid

### "Untrusted Developer"

**Problem:** App won't open, shows security warning

**Solution:**
1. Go to **Settings > General > VPN & Device Management**
2. Under **Developer App**, tap your name
3. Tap **Trust**

### "Unable to install app"

**Problem:** Xcode shows error when installing

**Solutions:**
1. Delete app from iPhone if already installed
2. Clean build folder: **Product > Clean Build Folder**
3. Disconnect and reconnect iPhone
4. Restart Xcode
5. Check Bundle Identifier is unique
6. Verify signing certificate in **Signing & Capabilities**

### "App expires after 7 days"

**Problem:** App stops working after a week

**Solutions:**
1. **Free account:** Reconnect to Mac and reinstall every 7 days
2. **Better:** Use TestFlight (apps last 90 days)
3. **Best:** Join Apple Developer Program ($99/year) for 1-year certificates

### "Build Failed"

**Problem:** Xcode shows build errors

**Solutions:**
1. Check error message in Xcode's Issue Navigator (⚠️ icon)
2. Make sure Xcode is up to date
3. Clean build: **Product > Clean Build Folder**
4. Restart Xcode
5. Common issues:
   - Missing semicolons or syntax errors in Swift files
   - Incorrect Bundle Identifier
   - Missing signing certificate

### "Provisional profile expired"

**Problem:** Can't install app after some time

**Solution:**
1. Go to **Signing & Capabilities** in Xcode
2. Uncheck **Automatically manage signing**
3. Check it again
4. This will regenerate the profile

---

## Server Configuration

### Allowing External Connections

If your Estimax server only listens on `localhost`, you need to allow external connections:

**Edit your server file** (likely `server.js` or similar):

```javascript
// Change from:
app.listen(3000, 'localhost', () => { ... })

// To:
app.listen(3000, '0.0.0.0', () => { ... })
```

This allows connections from any IP address, including your iPhone.

### Firewall Configuration

**Windows:**
```bash
# Allow port 3000
netsh advfirewall firewall add rule name="Estimax" dir=in action=allow protocol=TCP localport=3000
```

**Linux (ufw):**
```bash
sudo ufw allow 3000/tcp
```

**Mac:**
- System Preferences > Security & Privacy > Firewall
- Click Firewall Options
- Add your Node.js application

### HTTPS Setup (Production)

For production, you should use HTTPS:

1. Get a domain name
2. Point it to your server
3. Install SSL certificate (Let's Encrypt is free):
   ```bash
   sudo certbot --nginx -d estimax.yourdomain.com
   ```
4. Update your Express server to use HTTPS
5. Update app's `serverURL` to `https://estimax.yourdomain.com`

---

## Quick Reference

### Common Xcode Shortcuts

- `Cmd + R` - Build and run
- `Cmd + .` - Stop running
- `Cmd + B` - Build
- `Cmd + K` - Clean build folder
- `Cmd + Shift + K` - Clean build folder

### File Structure

```
ios-app/EstimaxApp/
├── EstimaxApp.xcodeproj/     # Xcode project file
└── EstimaxApp/
    ├── EstimaxApp.swift      # App entry point
    ├── ContentView.swift     # Main view (configure server URL here)
    ├── WebView.swift         # WebKit wrapper
    ├── Info.plist            # App configuration
    └── Assets.xcassets/      # App icons and images
```

### Important URLs

- App Store Connect: https://appstoreconnect.apple.com
- Apple Developer: https://developer.apple.com
- TestFlight: https://testflight.apple.com
- Xcode Download: https://apps.apple.com/us/app/xcode/id497799835

---

## Support

**For Mac/Xcode Issues:**
- Apple Developer Forums: https://developer.apple.com/forums/
- Stack Overflow: https://stackoverflow.com/questions/tagged/xcode

**For App Store Submission:**
- App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- App Store Connect Help: https://developer.apple.com/help/app-store-connect/

**For Estimax Server:**
- See main README.md in project root

---

## Next Steps

1. ✅ **Get access to a Mac** (rent cloud Mac, borrow, or use PWA alternative)
2. ✅ **Install Xcode** on the Mac
3. ✅ **Copy the iOS app project** to the Mac
4. ✅ **Configure server URL** in ContentView.swift
5. ✅ **Connect your iPhone** and run the app
6. ✅ **Trust the certificate** on your iPhone
7. ✅ **Test the app** and make sure it connects
8. ✅ **Optional: Set up TestFlight** for longer-lasting installation

Good luck! 🚀
