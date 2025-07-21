#!/bin/bash
set -e

echo "🚀 Preparing environment for offline Docker operations..."

# Create cache directories
mkdir -p .docker-cache/{deno,python,images}

echo "📦 Step 1: Pulling required base images..."
docker pull denoland/deno:2.1.1
docker pull python:3.9-alpine
docker pull postgres:17.2

echo "💾 Step 2: Saving base images to local cache..."
docker save denoland/deno:2.1.1 > .docker-cache/images/deno-2.1.1.tar
docker save python:3.9-alpine > .docker-cache/images/python-3.9-alpine.tar
docker save postgres:17.2 > .docker-cache/images/postgres-17.2.tar

echo "🔧 Step 3: Building dependency cache images..."
# Build just the dependency cache stages to create cached layers
docker build --target dependency_cache -t offline-deps-deno -f Dockerfile.offline .
docker build --target python_cache -t offline-deps-python -f Dockerfile.offline .

echo "💾 Step 4: Saving dependency cache images..."
docker save offline-deps-deno > .docker-cache/images/offline-deps-deno.tar
docker save offline-deps-python > .docker-cache/images/offline-deps-python.tar

echo "🎯 Step 5: Creating offline build script..."
cat > build-offline.sh << 'EOF'
#!/bin/bash
set -e

echo "🔄 Loading cached Docker images..."
docker load < .docker-cache/images/deno-2.1.1.tar
docker load < .docker-cache/images/python-3.9-alpine.tar
docker load < .docker-cache/images/postgres-17.2.tar
docker load < .docker-cache/images/offline-deps-deno.tar
docker load < .docker-cache/images/offline-deps-python.tar

echo "🏗️ Building offline Docker images..."
docker build -f Dockerfile.offline -t trust-assembly-offline .
docker build -f Dockerfile.dev.offline -t trust-assembly-dev-offline .

echo "✅ Offline build complete!"
echo "🚀 You can now run:"
echo "   docker-compose -f docker-compose.offline.yml up      # Production"
echo "   docker-compose -f docker-compose.dev.offline.yml up  # Development"
EOF

chmod +x build-offline.sh

echo "🎯 Step 6: Creating run script for completely offline operation..."
cat > run-offline.sh << 'EOF'
#!/bin/bash
set -e

MODE=${1:-dev}

if [ "$MODE" = "prod" ]; then
    echo "🚀 Starting in production mode (offline)..."
    # Disable network access for complete offline operation
    docker-compose -f docker-compose.offline.yml up
elif [ "$MODE" = "dev" ]; then
    echo "🚀 Starting in development mode (offline)..."
    docker-compose -f docker-compose.dev.offline.yml up
else
    echo "Usage: $0 [dev|prod]"
    echo "  dev  - Start development environment"
    echo "  prod - Start production environment"
    exit 1
fi
EOF

chmod +x run-offline.sh

echo "📝 Step 7: Creating offline preparation documentation..."
cat > OFFLINE-SETUP.md << 'EOF'
# Offline Docker Setup

This setup allows you to build and run the application without internet access.

## Initial Preparation (requires internet)

Run this once with internet access to cache all dependencies:

```bash
./prepare-offline.sh
```

This will:
- Pull all required base images
- Cache Deno dependencies
- Cache Python packages
- Save everything to `.docker-cache/`

## Building Offline

After running the preparation step, you can build without internet:

```bash
./build-offline.sh
```

## Running Offline

Start the application in offline mode:

```bash
# Development mode
./run-offline.sh dev

# Production mode  
./run-offline.sh prod
```

## For Complete Offline Operation

1. After preparation, you can disconnect from the internet
2. Use the build and run scripts above
3. All dependencies are cached locally

## Files Created

- `Dockerfile.offline` - Production offline Dockerfile
- `Dockerfile.dev.offline` - Development offline Dockerfile  
- `docker-compose.offline.yml` - Production offline compose
- `docker-compose.dev.offline.yml` - Development offline compose
- `.docker-cache/` - Local dependency cache
- `build-offline.sh` - Offline build script
- `run-offline.sh` - Offline run script

## Troubleshooting

If you encounter issues:

1. Ensure you ran `prepare-offline.sh` with internet access first
2. Check that `.docker-cache/` directory exists and contains files
3. Verify all base images are loaded: `docker images`

## Network Configuration

The docker-compose files include a `internal: false` network setting. 
To enforce complete offline operation, change this to `internal: true` 
in the compose files.
EOF

echo "✅ Offline preparation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Review the created files: Dockerfile.offline, docker-compose.offline.yml, etc."
echo "2. Run './build-offline.sh' to build images offline"
echo "3. Run './run-offline.sh dev' to start development environment"
echo "4. See OFFLINE-SETUP.md for detailed instructions"
echo ""
echo "🔒 For complete offline operation, disconnect from internet after this step."