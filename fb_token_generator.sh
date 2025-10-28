#!/bin/bash

# =============================================================================
# Facebook Token Generator Script
# =============================================================================
# This script helps you generate:
# 1. Long-lived User Access Token (60 days)
# 2. Never-expiring Page Access Token
# 
# Prerequisites:
# - Facebook App ID and App Secret
# - Short-lived User Access Token from Graph API Explorer
#   Get it from: https://developers.facebook.com/tools/explorer/
#   Required permissions: pages_show_list, pages_manage_posts, 
#   pages_manage_engagement, pages_read_engagement, pages_read_user_content,
#   pages_manage_metadata, pages_messaging, business_management
# =============================================================================

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to validate input
validate_input() {
    if [ -z "$1" ]; then
        print_error "Input cannot be empty!"
        return 1
    fi
    return 0
}

# Function to check if jq is installed
check_jq() {
    if ! command -v jq &> /dev/null; then
        print_warning "jq is not installed. Installing it will help format JSON output."
        echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
        return 1
    fi
    return 0
}

# Check for jq
HAS_JQ=$(check_jq && echo "yes" || echo "no")

# =============================================================================
# STEP 0: Collect Required Information
# =============================================================================
echo ""
echo "========================================================================"
echo "  Facebook Token Generator"
echo "========================================================================"
echo ""

# Get App ID
print_step "Enter your Facebook App ID:"
read -p "> " FB_APP_ID
validate_input "$FB_APP_ID" || exit 1

# Get App Secret
print_step "Enter your Facebook App Secret:"
read -s -p "> " FB_APP_SECRET
echo ""
validate_input "$FB_APP_SECRET" || exit 1

# Get Short-lived User Token
echo ""
print_step "Enter your Short-lived User Access Token:"
echo "   (Get it from: https://developers.facebook.com/tools/explorer/)"
echo "   Make sure to select ALL required permissions!"
read -p "> " FB_USER_SHORT_TOKEN
validate_input "$FB_USER_SHORT_TOKEN" || exit 1

echo ""
echo "========================================================================"
echo ""

# =============================================================================
# STEP 1: Exchange Short-lived Token for Long-lived User Token
# =============================================================================
print_step "STEP 1: Exchanging short-lived token for long-lived user token..."
echo ""

LONG_TOKEN_RESPONSE=$(curl -s -G "https://graph.facebook.com/v24.0/oauth/access_token" \
  -d "grant_type=fb_exchange_token" \
  -d "client_id=$FB_APP_ID" \
  -d "client_secret=$FB_APP_SECRET" \
  -d "fb_exchange_token=$FB_USER_SHORT_TOKEN")

# Check for errors
if echo "$LONG_TOKEN_RESPONSE" | grep -q "error"; then
    print_error "Failed to exchange token!"
    echo "$LONG_TOKEN_RESPONSE"
    exit 1
fi

# Extract long-lived user token
if [ "$HAS_JQ" = "yes" ]; then
    FB_LONG_USER_TOKEN=$(echo "$LONG_TOKEN_RESPONSE" | jq -r '.access_token')
    echo "$LONG_TOKEN_RESPONSE" | jq '.'
else
    FB_LONG_USER_TOKEN=$(echo "$LONG_TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    echo "$LONG_TOKEN_RESPONSE"
fi

if [ -z "$FB_LONG_USER_TOKEN" ] || [ "$FB_LONG_USER_TOKEN" = "null" ]; then
    print_error "Failed to extract long-lived user token!"
    exit 1
fi

print_success "Long-lived User Access Token generated (valid for 60 days)"
echo ""

# =============================================================================
# STEP 2: Get Page Access Tokens
# =============================================================================
print_step "STEP 2: Fetching Page Access Tokens..."
echo ""

PAGES_RESPONSE=$(curl -s -G "https://graph.facebook.com/v24.0/me/accounts" \
  -d "access_token=$FB_LONG_USER_TOKEN")

# Check for errors
if echo "$PAGES_RESPONSE" | grep -q "error"; then
    print_error "Failed to fetch pages!"
    echo "$PAGES_RESPONSE"
    exit 1
fi

# Display pages
if [ "$HAS_JQ" = "yes" ]; then
    echo "$PAGES_RESPONSE" | jq '.'
    PAGE_COUNT=$(echo "$PAGES_RESPONSE" | jq '.data | length')
else
    echo "$PAGES_RESPONSE"
    PAGE_COUNT=$(echo "$PAGES_RESPONSE" | grep -o '"id":"[^"]*"' | wc -l)
fi

if [ "$PAGE_COUNT" -eq 0 ]; then
    print_error "No pages found! Make sure your user account manages at least one Facebook Page."
    exit 1
fi

print_success "Found $PAGE_COUNT page(s)"
echo ""

# =============================================================================
# STEP 3: Select Page and Extract Token
# =============================================================================
if [ "$PAGE_COUNT" -eq 1 ]; then
    print_step "Using the only available page..."
    if [ "$HAS_JQ" = "yes" ]; then
        FB_PAGE_ID=$(echo "$PAGES_RESPONSE" | jq -r '.data[0].id')
        FB_PAGE_NAME=$(echo "$PAGES_RESPONSE" | jq -r '.data[0].name')
        FB_PAGE_TOKEN=$(echo "$PAGES_RESPONSE" | jq -r '.data[0].access_token')
    else
        FB_PAGE_ID=$(echo "$PAGES_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        FB_PAGE_NAME=$(echo "$PAGES_RESPONSE" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
        FB_PAGE_TOKEN=$(echo "$PAGES_RESPONSE" | grep -o '"access_token":"[^"]*"' | head -1 | cut -d'"' -f4)
    fi
else
    print_step "Multiple pages found. Enter the Page ID you want to use:"
    if [ "$HAS_JQ" = "yes" ]; then
        echo "$PAGES_RESPONSE" | jq -r '.data[] | "  - \(.name) (ID: \(.id))"'
    fi
    read -p "> " FB_PAGE_ID
    validate_input "$FB_PAGE_ID" || exit 1
    
    if [ "$HAS_JQ" = "yes" ]; then
        FB_PAGE_NAME=$(echo "$PAGES_RESPONSE" | jq -r ".data[] | select(.id==\"$FB_PAGE_ID\") | .name")
        FB_PAGE_TOKEN=$(echo "$PAGES_RESPONSE" | jq -r ".data[] | select(.id==\"$FB_PAGE_ID\") | .access_token")
    else
        # Manual extraction for page token (more complex without jq)
        FB_PAGE_TOKEN=$(echo "$PAGES_RESPONSE" | grep -A 3 "\"id\":\"$FB_PAGE_ID\"" | grep -o '"access_token":"[^"]*"' | head -1 | cut -d'"' -f4)
    fi
fi

if [ -z "$FB_PAGE_TOKEN" ] || [ "$FB_PAGE_TOKEN" = "null" ]; then
    print_error "Failed to extract Page Access Token!"
    exit 1
fi

echo ""
print_success "Selected Page: $FB_PAGE_NAME (ID: $FB_PAGE_ID)"
print_success "Page Access Token extracted (never expires)"
echo ""

# =============================================================================
# STEP 4: Verify Token and Permissions
# =============================================================================
print_step "STEP 4: Verifying token permissions..."
echo ""

DEBUG_RESPONSE=$(curl -s -G "https://graph.facebook.com/debug_token" \
  -d "input_token=$FB_PAGE_TOKEN" \
  -d "access_token=$FB_APP_ID|$FB_APP_SECRET")

if [ "$HAS_JQ" = "yes" ]; then
    echo "$DEBUG_RESPONSE" | jq '.'
    
    IS_VALID=$(echo "$DEBUG_RESPONSE" | jq -r '.data.is_valid')
    EXPIRES_AT=$(echo "$DEBUG_RESPONSE" | jq -r '.data.expires_at')
    SCOPES=$(echo "$DEBUG_RESPONSE" | jq -r '.data.scopes[]' | tr '\n' ',' | sed 's/,$//')
else
    echo "$DEBUG_RESPONSE"
    
    IS_VALID=$(echo "$DEBUG_RESPONSE" | grep -o '"is_valid":[^,}]*' | cut -d':' -f2)
    EXPIRES_AT=$(echo "$DEBUG_RESPONSE" | grep -o '"expires_at":[^,}]*' | cut -d':' -f2)
    SCOPES=$(echo "$DEBUG_RESPONSE" | grep -o '"scopes":\[[^]]*\]' | sed 's/"//g' | sed 's/scopes:\[//g' | sed 's/\]//g')
fi

echo ""
if [ "$IS_VALID" = "true" ]; then
    print_success "Token is valid!"
else
    print_error "Token is invalid!"
    exit 1
fi

if [ "$EXPIRES_AT" = "0" ]; then
    print_success "Token never expires"
else
    print_warning "Token will expire at: $(date -r $EXPIRES_AT 2>/dev/null || date -d @$EXPIRES_AT 2>/dev/null || echo $EXPIRES_AT)"
fi

echo ""
echo "Permissions granted:"
echo "$SCOPES" | tr ',' '\n' | sed 's/^/  - /'

# Check for critical permissions
REQUIRED_PERMS=("pages_manage_engagement" "pages_read_user_content")
MISSING_PERMS=()

for perm in "${REQUIRED_PERMS[@]}"; do
    if ! echo "$SCOPES" | grep -q "$perm"; then
        MISSING_PERMS+=("$perm")
    fi
done

echo ""
if [ ${#MISSING_PERMS[@]} -gt 0 ]; then
    print_warning "Missing critical permissions:"
    for perm in "${MISSING_PERMS[@]}"; do
        echo "  - $perm"
    done
    echo ""
    print_warning "Your token may not work properly for comment management!"
    print_warning "Please regenerate the short-lived token with ALL required permissions."
fi

# =============================================================================
# STEP 5: Subscribe Page to Webhooks (Optional)
# =============================================================================
echo ""
read -p "Do you want to subscribe this page to webhooks? (y/n): " SUBSCRIBE_WEBHOOK

if [ "$SUBSCRIBE_WEBHOOK" = "y" ] || [ "$SUBSCRIBE_WEBHOOK" = "Y" ]; then
    print_step "STEP 5: Subscribing page to webhooks..."
    echo ""
    
    WEBHOOK_RESPONSE=$(curl -s -X POST "https://graph.facebook.com/v24.0/$FB_PAGE_ID/subscribed_apps" \
      -d "subscribed_fields=feed,mention,messages,message_reactions,conversations,inbox_labels" \
      -d "access_token=$FB_PAGE_TOKEN")
    
    if [ "$HAS_JQ" = "yes" ]; then
        echo "$WEBHOOK_RESPONSE" | jq '.'
        SUCCESS=$(echo "$WEBHOOK_RESPONSE" | jq -r '.success')
    else
        echo "$WEBHOOK_RESPONSE"
        SUCCESS=$(echo "$WEBHOOK_RESPONSE" | grep -o '"success":[^,}]*' | cut -d':' -f2)
    fi
    
    if [ "$SUCCESS" = "true" ]; then
        print_success "Page subscribed to webhooks successfully!"
    else
        print_error "Failed to subscribe to webhooks"
    fi
fi

# =============================================================================
# FINAL OUTPUT
# =============================================================================
echo ""
echo "========================================================================"
echo "  TOKENS GENERATED SUCCESSFULLY!"
echo "========================================================================"
echo ""
echo "Save these tokens securely:"
echo ""
echo "# Long-lived User Access Token (60 days):"
echo "export FB_LONG_USER_TOKEN=\"$FB_LONG_USER_TOKEN\""
echo ""
echo "# Page Access Token (never expires):"
echo "export FB_PAGE_TOKEN=\"$FB_PAGE_TOKEN\""
echo "export FB_PAGE_ID=\"$FB_PAGE_ID\""
echo ""
echo "# App Credentials:"
echo "export FB_APP_ID=\"$FB_APP_ID\""
echo "export FB_APP_SECRET=\"$FB_APP_SECRET\""
echo ""
echo "========================================================================"
echo ""

# Save to file option
read -p "Save tokens to .env file? (y/n): " SAVE_TO_FILE

if [ "$SAVE_TO_FILE" = "y" ] || [ "$SAVE_TO_FILE" = "Y" ]; then
    ENV_FILE=".env.facebook_tokens"
    
    cat > "$ENV_FILE" << EOF
# Generated on $(date)
# Facebook App Credentials
FB_APP_ID="$FB_APP_ID"
FB_APP_SECRET="$FB_APP_SECRET"

# Long-lived User Access Token (valid for 60 days from generation date)
FB_LONG_USER_TOKEN="$FB_LONG_USER_TOKEN"

# Page Access Token (never expires)
FB_PAGE_TOKEN="$FB_PAGE_TOKEN"
FB_PAGE_ID="$FB_PAGE_ID"
FB_PAGE_NAME="$FB_PAGE_NAME"

# Usage:
# source $ENV_FILE
EOF
    
    print_success "Tokens saved to: $ENV_FILE"
    echo ""
    echo "To load these tokens, run:"
    echo "  source $ENV_FILE"
fi

echo ""
print_success "Done! Your tokens are ready to use."
echo ""
