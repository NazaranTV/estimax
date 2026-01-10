# Estimax iOS App

This is a native iOS wrapper app for Estimax that allows users to access the Estimax web application as a native iOS app.

## Features

- ✅ Native iOS app experience
- ✅ Full screen web view without browser chrome
- ✅ Access to device camera and photo library
- ✅ Persistent login sessions
- ✅ Support for both iPhone and iPad
- ✅ Portrait and landscape orientations
- ✅ Can be distributed via TestFlight or App Store

## Prerequisites

- macOS with Xcode 14.0 or later
- iOS 15.0 or later (target deployment)
- An Apple Developer account (for device testing and App Store distribution)

## Setup Instructions

### 1. Open the Project in Xcode

1. Open Xcode on your Mac
2. Select **File > Open**
3. Navigate to `ios-app/EstimaxApp/` folder
4. Select `EstimaxApp.xcodeproj` and click **Open**

### 2. Configure Your Server URL

1. Open `ContentView.swift`
2. Change the `serverURL` variable to your Estimax server URL:

```swift
// For local development (replace with your Mac's IP address)
let serverURL = "http://192.168.1.100:3000"

// For production (replace with your domain)
let serverURL = "https://estimax.yourdomain.com"
```

**Finding your Mac's IP address:**
- Open System Preferences > Network
- Your IP address is shown (e.g., 192.168.1.100)
- Make sure your iPhone is on the same Wi-Fi network

### 3. Configure Bundle Identifier

1. In Xcode, select the project in the navigator
2. Select the **EstimaxApp** target
3. Go to the **Signing & Capabilities** tab
4. Change the **Bundle Identifier** to something unique (e.g., `com.yourcompany.estimax`)

### 4. Configure Signing

1. In the **Signing & Capabilities** tab
2. Select your **Team** from the dropdown
3. Enable **Automatically manage signing**

### 5. Run on Simulator (Optional)

1. Select a simulator from the device dropdown (e.g., iPhone 14 Pro)
2. Click the Play button (▶) to build and run
3. The app will launch in the simulator

**Note:** For localhost connections to work in the simulator, use `http://localhost:3000` as your server URL.

### 6. Run on Physical Device

1. Connect your iPhone to your Mac with a USB cable
2. Unlock your iPhone and trust the computer if prompted
3. Select your iPhone from the device dropdown in Xcode
4. Click the Play button (▶) to build and install
5. On your iPhone, go to **Settings > General > VPN & Device Management**
6. Trust your developer certificate

The app should now launch on your iPhone!

## Distribution Options

### Option 1: TestFlight (Recommended for Testing)

TestFlight allows you to distribute your app to up to 10,000 external testers before publishing to the App Store.

1. Archive your app:
   - In Xcode, select **Product > Archive**
   - Wait for the build to complete
2. Upload to App Store Connect:
   - Click **Distribute App**
   - Select **App Store Connect**
   - Follow the prompts to upload
3. Configure in App Store Connect:
   - Go to [App Store Connect](https://appstoreconnect.apple.com)
   - Select your app
   - Go to **TestFlight** tab
   - Add testers or create a public link
4. Testers install via TestFlight app:
   - Testers download the TestFlight app from App Store
   - Accept the invitation or use the public link
   - Install and test your app

### Option 2: App Store (For Public Release)

1. Complete the TestFlight process first
2. Create app listing in App Store Connect
3. Fill in all required metadata:
   - App name, description, screenshots
   - Privacy policy
   - Support URL
4. Submit for review
5. Once approved, the app becomes available on the App Store

### Option 3: Ad Hoc Distribution (For Limited Devices)

1. Register device UDIDs in Apple Developer portal
2. Create an Ad Hoc provisioning profile
3. Archive and export with Ad Hoc profile
4. Distribute IPA file to registered devices

## Troubleshooting

### App doesn't connect to server

- **Check network**: Ensure your device is on the same network as your server
- **Check URL**: Verify the serverURL in ContentView.swift is correct
- **Check firewall**: Make sure your server allows connections from your device's IP
- **Use HTTPS**: For production, always use HTTPS with a valid SSL certificate

### Can't install on device

- **Trust certificate**: On your iPhone, go to Settings > General > VPN & Device Management
- **Update provisioning**: Delete the app and rebuild if you changed bundle identifier
- **Check signing**: Verify your Apple Developer account is active

### App shows blank screen

- **Check console**: Look at the Xcode console for error messages
- **Check server**: Make sure your Estimax server is running
- **Test URL**: Try opening the URL in Safari on your device first

### Can't upload to TestFlight

- **App Store Connect**: Make sure you've created an app record
- **Bundle ID**: Verify bundle identifier matches App Store Connect
- **Certificates**: Ensure your distribution certificate is valid

## App Permissions

The app requests the following permissions:

- **Camera**: To capture photos for estimates and invoices
- **Photo Library**: To attach existing photos to documents

These are configured in `Info.plist` and can be customized.

## Customization

### Change App Name

Edit `Info.plist` and change the `CFBundleDisplayName` value.

### Change App Icon

1. Create app icons in the required sizes (use a tool like [AppIcon.co](https://appicon.co))
2. Drag and drop the icons into the AppIcon asset in Assets.xcassets

### Add Splash Screen

1. Create a LaunchScreen.storyboard file
2. Configure it in the project settings

### Add Native Features

You can extend the app with native iOS features:

- Push notifications
- Face ID/Touch ID authentication
- Offline mode
- Camera integration
- File downloads
- Share sheet integration

## Support

For issues related to:
- **The web app**: See the main Estimax README
- **iOS app wrapper**: Check this README and Xcode console logs
- **App Store submission**: Refer to [Apple's App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

## License

Same as the main Estimax project.
