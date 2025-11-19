#!/bin/bash

# Colors for pretty output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⬇️  Pulling latest code from 'deployment' branch...${NC}"
git pull origin deployment

echo -e "${YELLOW}🏗️  Rebuilding and restarting the Server...${NC}"
# Uses your specific prod file
sudo docker compose -f docker-compose.prod.yml up -d --build server

echo -e "${GREEN}✅ Server updated successfully!${NC}"

# --- Database Check ---
echo ""
echo -e "${YELLOW}❓ Did you make changes to the Database Schema (drizzle)?${NC}"
read -p "   Run database migrations now? (y/N): " confirm

if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
    echo -e "${YELLOW}🔄 Running Drizzle Kit Push...${NC}"
    
    # This is the EXACT command that bypasses Turbo and injects the ENV var
    sudo docker compose -f docker-compose.prod.yml exec \
    -w /app/packages/db \
    -e DATABASE_URL="postgresql://postgres:password@postgres:5432/krypt-vault" \
    server pnpm exec drizzle-kit push

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Database synchronized successfully!${NC}"
    else
        echo -e "${RED}❌ Database migration failed.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}⏭️  Skipping database migration.${NC}"
fi

echo ""
echo -e "${GREEN}🚀 DEPLOYMENT COMPLETE.${NC}"