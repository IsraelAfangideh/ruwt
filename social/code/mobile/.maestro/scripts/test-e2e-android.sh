#!/bin/bash

# Use Java 17 for Android builds (required for Gradle compatibility)
export JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || echo $JAVA_HOME)

# Set Android SDK location
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

# #region agent log - Debug log file
DEBUG_LOG="/Users/israelafangideh/Documents/ruwt/.cursor/debug.log"
log_debug() {
  local hyp="$1" loc="$2" msg="$3" data="$4"
  echo "{\"hypothesisId\":\"$hyp\",\"location\":\"$loc\",\"message\":\"$msg\",\"data\":$data,\"timestamp\":$(date +%s)000}" >> "$DEBUG_LOG"
}
# #endregion

# Start Metro in the background (with --clear to ensure fresh bundle)
echo "Starting Metro bundler..."
EXPO_PUBLIC_MOCK_MODE=true npx expo start --no-dev --clear > /dev/null 2>&1 &
METRO_PID=$!

# Wait for Metro to be ready
echo "Waiting for Metro to be ready..."
sleep 8

# #region agent log - Check Metro status (Hypothesis D)
METRO_CHECK=$(curl -s http://localhost:8081/status 2>&1 || echo "FAILED")
log_debug "D" "script:metro-check" "Metro bundler status" "{\"status\":\"$METRO_CHECK\",\"pid\":$METRO_PID}"
# #endregion

# Build and install the app
echo "Building and installing Android app..."
EXPO_PUBLIC_MOCK_MODE=true npx expo run:android

# #region agent log - Check ADB devices (Hypothesis A)
ADB_DEVICES=$(adb devices 2>&1 | tail -n +2 | grep -v "^$" || echo "NONE")
log_debug "A" "script:adb-devices" "ADB connected devices" "{\"devices\":\"$ADB_DEVICES\"}"
# #endregion

# #region agent log - Check app installed (Hypothesis B)
APP_INSTALLED=$(adb shell pm list packages 2>&1 | grep "com.ruwt.app" || echo "NOT_FOUND")
log_debug "B" "script:app-installed" "App installation check" "{\"result\":\"$APP_INSTALLED\"}"
# #endregion

# Stop the app if it's running (so Maestro can launch it fresh)
echo "Stopping app to allow Maestro to launch it..."
STOP_RESULT=$(adb shell am force-stop com.ruwt.app 2>&1 || echo "FAILED")

# #region agent log - Check force-stop result (Hypothesis A)
log_debug "A" "script:force-stop" "Force stop result" "{\"result\":\"$STOP_RESULT\"}"
# #endregion

# #region agent log - Install Maestro driver APKs if not present (Hypothesis F)
MAESTRO_DRIVER=$(adb shell pm list packages 2>&1 | grep "dev.mobile.maestro" || echo "NOT_FOUND")
if [ "$MAESTRO_DRIVER" = "NOT_FOUND" ]; then
  echo "Installing Maestro driver APKs..."
  cd /tmp && unzip -o ~/.maestro/lib/maestro-client.jar maestro-server.apk maestro-app.apk 2>/dev/null
  adb install -r maestro-server.apk 2>/dev/null
  adb install -r maestro-app.apk 2>/dev/null
  log_debug "F" "script:driver-install" "Installed Maestro driver" "{\"status\":\"installed\"}"
else
  log_debug "F" "script:driver-install" "Maestro driver already installed" "{\"status\":\"present\"}"
fi
# #endregion

# #region agent log - Set up port forwarding for Maestro driver (Hypothesis G)
adb forward --remove-all 2>/dev/null
adb forward tcp:7001 tcp:7001
log_debug "G" "script:port-forward" "Port forwarding set up" "{\"port\":7001}"
# #endregion

# Wait a moment for the app to fully stop
sleep 2

# Run Maestro tests (Maestro will launch the app)
echo "Running Maestro tests..."
# Debug output goes to .maestro-debug (gitignored, can be safely deleted)
EXPO_PUBLIC_MOCK_MODE=true maestro test .maestro --debug-output ./.maestro-debug 2>&1 | tee /tmp/maestro-output.txt

# #region agent log - Capture Maestro output (Hypothesis C/E)
MAESTRO_OUTPUT=$(cat /tmp/maestro-output.txt 2>&1 | head -50 | tr '\n' ' ' | tr '"' "'")
log_debug "E" "script:maestro-output" "Maestro test output" "{\"output\":\"$MAESTRO_OUTPUT\"}"
# #endregion

# Clean up: kill Metro
echo "Stopping Metro bundler..."
kill $METRO_PID 2>/dev/null || true

