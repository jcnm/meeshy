#!/bin/bash

# Phase 3 Load Testing Runner
# Executes all 5 k6 load testing scenarios with proper configuration
# Usage: bash scripts/run-load-tests.sh [scenario] [environment]
# Examples:
#   bash scripts/run-load-tests.sh                  (run all scenarios)
#   bash scripts/run-load-tests.sh 01               (run enrollment test only)
#   bash scripts/run-load-tests.sh all staging      (run all tests on staging)

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TESTS_DIR="$PROJECT_ROOT/gateway/tests/load-testing"
RESULTS_DIR="$PROJECT_ROOT/load-test-results"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3001}"
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
ENVIRONMENT="${2:-local}"

# Scenario selection
SCENARIO="${1:-all}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASSED_TESTS=0
FAILED_TESTS=0

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Phase 3 Load Testing Suite${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Functions
print_info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
  ((PASSED_TESTS++))
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
  ((FAILED_TESTS++))
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# Pre-flight checks
pre_flight_check() {
  print_info "Running pre-flight checks..."

  # Check k6 installation
  if ! command -v k6 &> /dev/null; then
    print_error "k6 not installed. Install with: brew install k6 or npm install -g k6"
    return 1
  fi
  print_success "k6 installed"

  # Check API connectivity
  if ! curl -sf "$API_BASE_URL/health" &>/dev/null; then
    print_warning "API not responding at $API_BASE_URL (will start if using Docker)"
  else
    print_success "API responding at $API_BASE_URL"
  fi

  # Check Prometheus connectivity
  if ! curl -sf "$PROMETHEUS_URL/-/healthy" &>/dev/null; then
    print_warning "Prometheus not responding at $PROMETHEUS_URL"
  else
    print_success "Prometheus responding at $PROMETHEUS_URL"
  fi

  # Check test files exist
  if [ ! -d "$TESTS_DIR" ]; then
    print_error "Test directory not found: $TESTS_DIR"
    return 1
  fi
  print_success "Test directory found"

  return 0
}

# Create results directory
setup_results_dir() {
  mkdir -p "$RESULTS_DIR"
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  TEST_RUN_DIR="$RESULTS_DIR/run_$TIMESTAMP"
  mkdir -p "$TEST_RUN_DIR"
  print_success "Results directory: $TEST_RUN_DIR"
}

# Run individual test
run_test() {
  local test_num=$1
  local test_name=$2
  local test_file=$3
  local vus=${4:-100}
  local duration=${5:-5m}

  echo -e "\n${BLUE}### Test $test_num: $test_name ###${NC}\n"
  print_info "VUs: $vus, Duration: $duration"
  print_info "File: $test_file"

  local test_results="$TEST_RUN_DIR/${test_num}_${test_name// /_}.json"

  # Check if test file exists
  if [ ! -f "$test_file" ]; then
    print_error "Test file not found: $test_file"
    return 1
  fi

  # Run k6 test
  print_info "Starting test..."
  if k6 run "$test_file" \
    --vus "$vus" \
    --duration "$duration" \
    --summary-export="$test_results" \
    -e API_BASE_URL="$API_BASE_URL" \
    -e PROMETHEUS_URL="$PROMETHEUS_URL" \
    -e ENVIRONMENT="$ENVIRONMENT"; then

    print_success "$test_name completed"

    # Display summary
    if [ -f "$test_results" ]; then
      print_info "Results saved to: $test_results"
    fi

    return 0
  else
    print_error "$test_name failed"
    return 1
  fi
}

# Parse and display test results
display_results() {
  echo -e "\n${BLUE}========================================${NC}"
  echo -e "${BLUE}Test Results Summary${NC}"
  echo -e "${BLUE}========================================${NC}\n"

  local results_file="$TEST_RUN_DIR/summary.txt"

  {
    echo "Phase 3 Load Testing Results"
    echo "Timestamp: $(date)"
    echo "Environment: $ENVIRONMENT"
    echo "API Base URL: $API_BASE_URL"
    echo ""
    echo "Prometheus: $PROMETHEUS_URL"
    echo "Grafana: $GRAFANA_URL"
    echo ""
    echo "Tests Passed: $PASSED_TESTS"
    echo "Tests Failed: $FAILED_TESTS"
    echo ""
    echo "Results Directory: $TEST_RUN_DIR"
    echo ""
    echo "Next Steps:"
    echo "1. Review detailed results in: $TEST_RUN_DIR"
    echo "2. View metrics in Grafana: $GRAFANA_URL/d/meeshy-dma-phase3"
    echo "3. Check Prometheus: $PROMETHEUS_URL"
  } | tee "$results_file"

  echo ""
  if [ $FAILED_TESTS -eq 0 ]; then
    print_success "All tests passed!"
    return 0
  else
    print_error "$FAILED_TESTS test(s) failed"
    return 1
  fi
}

# Main execution
main() {
  print_info "Environment: $ENVIRONMENT"
  print_info "API URL: $API_BASE_URL"
  print_info "Scenario: $SCENARIO\n"

  # Pre-flight checks
  if ! pre_flight_check; then
    print_error "Pre-flight checks failed"
    exit 1
  fi

  # Setup results directory
  setup_results_dir

  # Run selected scenarios
  case "$SCENARIO" in
    "all"|"1"|"*")
      echo -e "\n${YELLOW}Running all 5 load testing scenarios...${NC}"

      # Test 1: Enrollment Concurrency
      run_test "01" "Enrollment Concurrency" \
        "$TESTS_DIR/01-enrollment-concurrency.js" "100" "4m" || true

      # Test 2: Message Throughput
      run_test "02" "Message Throughput" \
        "$TESTS_DIR/02-message-throughput.js" "100" "1h" || true

      # Test 3: Offline Queue
      run_test "03" "Offline Queue" \
        "$TESTS_DIR/03-offline-queue.js" "500" "2h" || true

      # Test 4: Session Establishment
      run_test "04" "Session Establishment" \
        "$TESTS_DIR/04-session-establishment.js" "1000" "10m" || true

      # Test 5: 24-Hour Stability
      run_test "05" "24-Hour Stability" \
        "$TESTS_DIR/05-24hour-stability.js" "100" "1h" || true
      ;;

    "01"|"enrollment")
      run_test "01" "Enrollment Concurrency" \
        "$TESTS_DIR/01-enrollment-concurrency.js" "100" "4m" || exit 1
      ;;

    "02"|"throughput")
      run_test "02" "Message Throughput" \
        "$TESTS_DIR/02-message-throughput.js" "100" "1h" || exit 1
      ;;

    "03"|"offline")
      run_test "03" "Offline Queue" \
        "$TESTS_DIR/03-offline-queue.js" "500" "2h" || exit 1
      ;;

    "04"|"sessions")
      run_test "04" "Session Establishment" \
        "$TESTS_DIR/04-session-establishment.js" "1000" "10m" || exit 1
      ;;

    "05"|"stability")
      run_test "05" "24-Hour Stability" \
        "$TESTS_DIR/05-24hour-stability.js" "100" "24h" || exit 1
      ;;

    *)
      print_error "Unknown scenario: $SCENARIO"
      echo "Valid scenarios: all, 01, 02, 03, 04, 05, enrollment, throughput, offline, sessions, stability"
      exit 1
      ;;
  esac

  # Display results
  display_results
}

# Run main
main
