#!/usr/bin/env bash
set -e

# DealLens — Start both API and Web services concurrently
# Handles graceful shutdown on SIGINT / SIGTERM (Ctrl+C)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Formatting colors
BOLD="\033[1m"
GREEN="\033[32m"
BLUE="\033[34m"
YELLOW="\033[33m"
CYAN="\033[36m"
RESET="\033[0m"

echo -e "${BOLD}${CYAN}====================================================${RESET}"
echo -e "${BOLD}${CYAN}   🚀 Starting DealLens Services (API & Web)       ${RESET}"
echo -e "${BOLD}${CYAN}====================================================${RESET}"

# Verify pnpm
if ! command -v pnpm &> /dev/null; then
  echo -e "${YELLOW}Warning: pnpm was not found in PATH. Attempting with npx pnpm...${RESET}"
  PNPM_CMD="npx pnpm"
else
  PNPM_CMD="pnpm"
fi

# Ensure shared package is built first
echo -e "${BLUE}ℹ Building @deallens/shared domain package...${RESET}"
$PNPM_CMD --filter @deallens/shared build

API_PID=""
WEB_PID=""

cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 Shutting down DealLens services...${RESET}"
  if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi
  if [ -n "$WEB_PID" ] && kill -0 "$WEB_PID" 2>/dev/null; then
    kill "$WEB_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
  echo -e "${GREEN}✓ All services stopped cleanly.${RESET}"
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo -e "${BLUE}ℹ Launching Fastify API server (Port 3001)...${RESET}"
$PNPM_CMD --filter @deallens/api dev &
API_PID=$!

echo -e "${BLUE}ℹ Launching Next.js Web application (Port 3000)...${RESET}"
$PNPM_CMD --filter @deallens/web dev &
WEB_PID=$!

echo ""
echo -e "${BOLD}${GREEN}✓ Both services are launching:${RESET}"
echo -e "  - ${BOLD}Web Frontend:${RESET} http://localhost:3000"
echo -e "  - ${BOLD}Fastify API:${RESET}  http://localhost:3001"
echo -e "${CYAN}Press Ctrl+C to stop both services.${RESET}"
echo ""

# Wait for background processes
wait "$API_PID" "$WEB_PID"
