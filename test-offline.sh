#!/bin/bash
set -e

echo "🧪 Testing offline Docker setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

info() {
    echo -e "ℹ️  $1"
}

# Test 1: Check if cache directory exists
info "Test 1: Checking cache directory..."
if [ -d ".docker-cache" ]; then
    success "Cache directory exists"
else
    error "Cache directory not found. Run './prepare-offline.sh' first."
    exit 1
fi

# Test 2: Check if cached images exist
info "Test 2: Checking cached images..."
REQUIRED_IMAGES=(
    "deno-2.1.1.tar"
    "python-3.9-alpine.tar" 
    "postgres-17.2.tar"
    "offline-deps-deno.tar"
    "offline-deps-python.tar"
)

for image in "${REQUIRED_IMAGES[@]}"; do
    if [ -f ".docker-cache/images/$image" ]; then
        success "Found cached image: $image"
    else
        error "Missing cached image: $image"
        exit 1
    fi
done

# Test 3: Test offline build
info "Test 3: Testing offline build..."
if [ -f "build-offline.sh" ]; then
    success "Offline build script exists"
    warning "To test offline build, run: ./build-offline.sh"
else
    error "Offline build script not found"
    exit 1
fi

# Test 4: Check Docker compose files
info "Test 4: Checking Docker compose files..."
COMPOSE_FILES=(
    "docker-compose.offline.yml"
    "docker-compose.dev.offline.yml"
)

for file in "${COMPOSE_FILES[@]}"; do
    if [ -f "$file" ]; then
        success "Found compose file: $file"
    else
        error "Missing compose file: $file"
        exit 1
    fi
done

# Test 5: Check Dockerfiles
info "Test 5: Checking Dockerfiles..."
DOCKERFILES=(
    "Dockerfile.offline"
    "Dockerfile.dev.offline"
)

for file in "${DOCKERFILES[@]}"; do
    if [ -f "$file" ]; then
        success "Found Dockerfile: $file"
    else
        error "Missing Dockerfile: $file"
        exit 1
    fi
done

# Test 6: Check run script
info "Test 6: Checking run script..."
if [ -f "run-offline.sh" ] && [ -x "run-offline.sh" ]; then
    success "Offline run script exists and is executable"
else
    error "Offline run script not found or not executable"
    exit 1
fi

# Test 7: Validate Docker compose syntax
info "Test 7: Validating Docker compose syntax..."
for file in "${COMPOSE_FILES[@]}"; do
    if docker-compose -f "$file" config > /dev/null 2>&1; then
        success "Valid compose syntax: $file"
    else
        error "Invalid compose syntax: $file"
        exit 1
    fi
done

# Test 8: Check network isolation settings
info "Test 8: Checking network isolation settings..."
if grep -q "internal: false" docker-compose.offline.yml; then
    warning "Network isolation is disabled (internal: false). Change to 'internal: true' for complete offline operation."
else
    success "Network isolation appears to be configured"
fi

# Test 9: Environment file check
info "Test 9: Checking environment file..."
if [ -f "apps/webapp/db.local.env" ]; then
    success "Database environment file exists"
else
    warning "Database environment file not found. You may need to create apps/webapp/db.local.env"
fi

# Summary
echo ""
info "🎯 Test Summary:"
success "All offline Docker setup tests passed!"
echo ""
echo "📋 Next steps to run offline:"
echo "1. Disconnect from internet (optional, for complete offline testing)"
echo "2. Run: ./build-offline.sh"
echo "3. Run: ./run-offline.sh dev"
echo ""
echo "🔒 For enforced offline operation:"
echo "- Change 'internal: false' to 'internal: true' in compose files"
echo "- This will prevent containers from accessing external networks"