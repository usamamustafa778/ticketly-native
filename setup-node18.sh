#!/bin/zsh

# =============================================================================
# Node.js 18 Setup Script for Expo React Native Project
# =============================================================================
# This script installs nvm, sets up Node.js 18, and reinstalls dependencies
# for better compatibility with Supabase and React Native.
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_step() {
    echo -e "\n${BLUE}==>${NC} ${1}"
}

print_success() {
    echo -e "${GREEN}✓${NC} ${1}"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} ${1}"
}

print_error() {
    echo -e "${RED}✗${NC} ${1}"
}

# Get the current directory (should be your project root)
PROJECT_DIR="$(pwd)"
PROJECT_NAME="$(basename "$PROJECT_DIR")"

print_step "Setting up Node.js 18 for Expo React Native project: $PROJECT_NAME"
echo "Project directory: $PROJECT_DIR"

# =============================================================================
# Step 1: Install nvm if not already installed
# =============================================================================
print_step "Step 1: Checking for nvm installation"

if command -v nvm >/dev/null 2>&1; then
    print_success "nvm is already installed"
elif [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    print_success "nvm is installed but not loaded in current shell"
    source "$HOME/.nvm/nvm.sh"
else
    print_step "Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    
    # Source nvm for current session
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
    
    if command -v nvm >/dev/null 2>&1; then
        print_success "nvm installed successfully"
    else
        print_error "nvm installation failed. Please install manually and rerun this script."
        exit 1
    fi
fi

# =============================================================================
# Step 2: Configure .zshrc for automatic nvm loading
# =============================================================================
print_step "Step 2: Configuring .zshrc for automatic nvm loading"

ZSHRC="$HOME/.zshrc"
NVM_LINES='# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion'

if grep -q "NVM_DIR" "$ZSHRC" 2>/dev/null; then
    print_success ".zshrc already configured for nvm"
else
    echo -e "\n$NVM_LINES" >> "$ZSHRC"
    print_success "Added nvm configuration to .zshrc"
fi

# Source the updated .zshrc
source "$ZSHRC" 2>/dev/null || true

# =============================================================================
# Step 3: Install Node.js 18 and set as default
# =============================================================================
print_step "Step 3: Installing Node.js 18 LTS"

# Ensure nvm is loaded
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js 18 LTS
nvm install 18
nvm use 18
nvm alias default 18

print_success "Node.js 18 installed and set as default"

# =============================================================================
# Step 4: Verify Node.js and npm versions
# =============================================================================
print_step "Step 4: Verifying Node.js and npm versions"

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)

echo "Node.js version: $NODE_VERSION"
echo "npm version: $NPM_VERSION"

# Check if Node version starts with v18
if [[ $NODE_VERSION == v18* ]]; then
    print_success "Node.js 18 is active"
else
    print_error "Expected Node.js 18, but got $NODE_VERSION"
    print_warning "Trying to switch to Node 18..."
    nvm use 18
    NODE_VERSION=$(node --version)
    if [[ $NODE_VERSION == v18* ]]; then
        print_success "Successfully switched to Node.js 18"
    else
        print_error "Failed to switch to Node.js 18. Please check your nvm installation."
        exit 1
    fi
fi

# =============================================================================
# Step 5: Clean up existing node_modules and package-lock.json
# =============================================================================
print_step "Step 5: Cleaning up existing dependencies"

if [[ -d "node_modules" ]]; then
    print_step "Removing node_modules directory..."
    rm -rf node_modules
    print_success "node_modules removed"
else
    print_success "node_modules directory not found (already clean)"
fi

if [[ -f "package-lock.json" ]]; then
    print_step "Removing package-lock.json..."
    rm package-lock.json
    print_success "package-lock.json removed"
else
    print_success "package-lock.json not found (already clean)"
fi

# Also clean npm cache to avoid potential issues
print_step "Cleaning npm cache..."
npm cache clean --force
print_success "npm cache cleaned"

# =============================================================================
# Step 6: Reinstall dependencies cleanly
# =============================================================================
print_step "Step 6: Reinstalling project dependencies"

print_step "Running npm install..."
if npm install; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    print_warning "This might be due to package compatibility issues with Node 18"
    print_warning "Trying with --legacy-peer-deps flag..."
    
    if npm install --legacy-peer-deps; then
        print_success "Dependencies installed with legacy peer deps"
    else
        print_error "Failed to install dependencies even with --legacy-peer-deps"
        print_warning "You may need to manually resolve dependency conflicts"
        exit 1
    fi
fi

# =============================================================================
# Step 7: Install Supabase and React Native UI Elements
# =============================================================================
print_step "Step 7: Installing @supabase/supabase-js and @rneui/themed"

print_step "Installing @supabase/supabase-js..."
if npm install @supabase/supabase-js; then
    print_success "@supabase/supabase-js installed successfully"
else
    print_warning "Failed to install @supabase/supabase-js with standard install, trying with --legacy-peer-deps..."
    if npm install @supabase/supabase-js --legacy-peer-deps; then
        print_success "@supabase/supabase-js installed with legacy peer deps"
    else
        print_error "Failed to install @supabase/supabase-js"
    fi
fi

print_step "Installing @rneui/themed and its peer dependencies..."
# Install React Native Elements UI with required peer dependencies
if npm install @rneui/themed @rneui/base react-native-safe-area-context react-native-vector-icons; then
    print_success "@rneui/themed and peer dependencies installed successfully"
else
    print_warning "Failed to install @rneui/themed with standard install, trying with --legacy-peer-deps..."
    if npm install @rneui/themed @rneui/base react-native-safe-area-context react-native-vector-icons --legacy-peer-deps; then
        print_success "@rneui/themed and peer dependencies installed with legacy peer deps"
    else
        print_error "Failed to install @rneui/themed"
    fi
fi

# =============================================================================
# Final verification and summary
# =============================================================================
print_step "Setup Complete! Final verification:"

echo -e "\n${GREEN}=== SUMMARY ===${NC}"
echo "✓ nvm installed and configured"
echo "✓ Node.js version: $(node --version)"
echo "✓ npm version: $(npm --version)"
echo "✓ Dependencies cleaned and reinstalled"
echo "✓ @supabase/supabase-js installed"
echo "✓ @rneui/themed installed"

print_step "Next steps:"
echo "1. Restart your terminal or run: source ~/.zshrc"
echo "2. Verify your setup with: node --version && npm --version"
echo "3. Try running your Expo project: npm start"

print_step "If you encounter any issues:"
echo "• For Expo: npx expo doctor"
echo "• For React Native: npx react-native doctor"
echo "• For iOS development: cd ios && pod install (if you have an ios folder)"

print_success "Setup completed successfully! 🚀"

# Create a .nvmrc file for this project
echo "18" > .nvmrc
print_success "Created .nvmrc file to lock this project to Node 18"

echo -e "\n${BLUE}Tip:${NC} In the future, when you cd into this project directory,"
echo "you can run 'nvm use' to automatically switch to Node 18."

