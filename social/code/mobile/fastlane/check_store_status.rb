require 'spaceship'

# This script checks the status of the current app version in App Store Connect
# Returns exit code 0 if we should proceed with a build (Ready for Sale, Rejected)
# Returns exit code 1 if we should skip the build (Waiting for Review, In Review)

def check_status
  # Authentication
  # We expect these environment variables to be set in the CI environment
  key_content = ENV['APP_STORE_CONNECT_API_KEY_KEY']
  issuer_id = ENV['APP_STORE_CONNECT_API_KEY_ISSUER_ID']
  key_id = ENV['APP_STORE_CONNECT_API_KEY_KEY_ID']
  
  unless key_content && issuer_id && key_id
    puts "Missing App Store Connect API keys. Skipping status check."
    exit 0 # Fail open: if we can't check, assume we can build (or maybe fail closed depending on preference)
  end

  # Create the token
  token = Spaceship::ConnectAPI::Token.create(
    key_id: key_id,
    issuer_id: issuer_id,
    filepath: nil,
    key: key_content
  )
  
  Spaceship::ConnectAPI.token = token
  
  # Find the app
  # You might need to set your Bundle ID here or via ENV
  bundle_id = "com.ruwt.app" 
  app = Spaceship::ConnectAPI::App.find(bundle_id)
  
  unless app
    puts "Could not find app with bundle ID #{bundle_id}"
    exit 1
  end

  # Get the latest version (edit or live)
  # We specifically want to check the *edit* version if it exists, as that's what's in queue
  edit_version = app.get_edit_app_store_version
  
  unless edit_version
    puts "No version currently in edit mode. Safe to build."
    exit 0
  end
  
  status = edit_version.app_store_state
  puts "Current App Store Status: #{status}"

  # Logic Table
  # WAITING_FOR_REVIEW -> Skip (Don't reset queue)
  # IN_REVIEW -> Skip (Don't reset queue)
  # PREPARE_FOR_SUBMISSION -> Proceed (We are building the binary to submit!)
  # DEVELOPER_REJECTED -> Proceed (We need to fix it)
  # REJECTED -> Proceed (We need to fix it)
  # METADATA_REJECTED -> Proceed (We might need a new binary)
  # READY_FOR_SALE -> Proceed (Time for next version)
  
  case status
  when "WAITING_FOR_REVIEW", "IN_REVIEW"
    puts "App is currently in review process. Skipping build to preserve queue position."
    exit 1
  else
    puts "Status '#{status}' allows for new submission. Proceeding with build."
    exit 0
  end
rescue => e
  puts "Error checking store status: #{e.message}"
  exit 1 # Fail safe: don't build if we error out
end

check_status

