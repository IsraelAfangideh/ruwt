# Maestro E2E Tests

This directory contains end-to-end tests for the Ruwt mobile app using [Maestro](https://maestro.mobile.dev/).

## Installation

Install Maestro CLI:

```bash
curl -Ls https://get.maestro.mobile.dev | bash
```

Or on macOS with Homebrew:

```bash
brew tap mobile-dev-inc/tap
brew install maestro
```

## Running Tests

### Quick Start (One Command)

Build and run all tests in one command. This automatically starts Metro bundler, builds the app, runs tests, and cleans up:

```bash
# For iOS (requires iOS Simulator to be booted)
npm run test:e2e:ios

# For Android (requires Android Emulator to be booted)
npm run test:e2e:android
```

**Note:** These commands handle Metro bundler automatically - you don't need to start it separately.

### Manual Workflow (For Iterative Testing)

If you're iterating on tests and don't want to rebuild every time:

1. **Start Metro bundler (in one terminal):**
   ```bash
   npm run start:mock
   ```

2. **Build and install the app once (in another terminal):**
   ```bash
   # For iOS Simulator
   npm run build:ios
   
   # For Android Emulator
   npm run build:android
   ```

3. **Run tests (can run multiple times without rebuilding):**
   ```bash
   npm run test:e2e
   ```

### Run Single Test

```bash
EXPO_PUBLIC_MOCK_MODE=true npm run test:e2e:single .maestro/01-navigation.yaml
```

### Maestro Studio (UI Element Identification)

```bash
npm run test:e2e:watch
```

This opens Maestro Studio, which helps you identify UI elements and write tests interactively.

## Test Structure

Tests are organized by feature:

- `01-navigation.yaml` - Navigation between screens (includes Safety Latch assertion)
- `02-runners-list.yaml` - Runner list functionality
- `03-chat-basic.yaml` - Basic chat functionality
- `04-chat-blocked.yaml` - Blocked message flow
- `05-chat-approved.yaml` - Approved message flow
- `06-menu-actions.yaml` - Menu actions (block/unblock, report)
- `07-report-modal.yaml` - Report submission flow
- `08-about-screen.yaml` - About screen
- `09-error-handling.yaml` - Error scenarios

## Safety Latch

The first test (`01-navigation.yaml`) includes an assertion that verifies the "⚠️ MOCK MODE ACTIVE" banner is visible. If this banner is missing, the test will fail immediately, preventing accidental testing against the real API.

## Writing New Tests

1. Use Maestro Studio to identify UI elements:
   ```bash
   npm run test:e2e:watch
   ```

2. Create a new YAML file in this directory following the naming convention: `XX-feature-name.yaml`

3. Test files should:
   - Start with app launch
   - Include clear test descriptions
   - Use assertions to verify expected behavior
   - Clean up state if needed

## Mock Mode

All tests run with `EXPO_PUBLIC_MOCK_MODE=true` to ensure no real API calls are made. The app will display a red banner at the top when mock mode is active.


