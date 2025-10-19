#!/usr/bin/env bash

#########################################
# MMR Test Suite
# Automated tests for Meeshy Message Receiver
#########################################

set -euo pipefail

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Test results
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test configuration
readonly MMR_SCRIPT="./mmr.sh"
readonly TEST_PASSWORD="${MEESHY_PASSWORD:-}"
readonly TEST_USERNAME="${MEESHY_USERNAME:-meeshy}"
readonly TEST_CONVERSATION="${MEESHY_CONVERSATION_ID:-meeshy}"

#########################################
# Test helpers
#########################################

log_test() {
    echo -e "${BLUE}[TEST]${NC} $*"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $*"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $*"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

run_test() {
    local test_name="$1"
    shift
    local test_command="$@"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    log_test "$test_name"
    
    if eval "$test_command" &>/dev/null; then
        log_pass "$test_name"
        return 0
    else
        log_fail "$test_name"
        return 1
    fi
}

assert_exit_code() {
    local expected=$1
    local actual=$2
    local test_name="$3"
    
    if [[ "$actual" -eq "$expected" ]]; then
        log_pass "$test_name (exit code: $actual)"
        return 0
    else
        log_fail "$test_name (expected: $expected, got: $actual)"
        return 1
    fi
}

assert_contains() {
    local haystack="$1"
    local needle="$2"
    local test_name="$3"
    
    if echo "$haystack" | grep -q "$needle"; then
        log_pass "$test_name"
        return 0
    else
        log_fail "$test_name (string not found: $needle)"
        return 1
    fi
}

assert_json_valid() {
    local json_string="$1"
    local test_name="$2"
    
    if echo "$json_string" | jq empty 2>/dev/null; then
        log_pass "$test_name"
        return 0
    else
        log_fail "$test_name (invalid JSON)"
        return 1
    fi
}

#########################################
# Test suite
#########################################

test_help() {
    log_test "Help message display"
    
    local output
    output=$("$MMR_SCRIPT" --help 2>&1)
    
    assert_contains "$output" "Meeshy Message Receiver" "Help contains title"
    assert_contains "$output" "USAGE:" "Help contains usage"
    assert_contains "$output" "OPTIONS:" "Help contains options"
    assert_contains "$output" "EXAMPLES:" "Help contains examples"
}

test_version() {
    log_test "Version in help"
    
    local output
    output=$("$MMR_SCRIPT" --help 2>&1)
    
    assert_contains "$output" "v1.0.0" "Version number present"
}

test_missing_password() {
    log_test "Error on missing password"
    
    unset MEESHY_PASSWORD
    local exit_code=0
    "$MMR_SCRIPT" -n 1 2>/dev/null || exit_code=$?
    
    assert_exit_code 78 "$exit_code" "Missing password returns config error"
}

test_count_filter() {
    if [[ -z "$TEST_PASSWORD" ]]; then
        log_test "Count filter (skipped - no password)"
        return 0
    fi
    
    log_test "Count filter (-n 5)"
    
    local output
    output=$(export MEESHY_PASSWORD="$TEST_PASSWORD" && "$MMR_SCRIPT" -n 5 -f json 2>/dev/null)
    
    assert_json_valid "$output" "Count filter returns valid JSON"
    
    local count
    count=$(echo "$output" | jq 'length')
    
    if [[ "$count" -le 5 ]] && [[ "$count" -gt 0 ]]; then
        log_pass "Count filter returns correct number of messages"
    else
        log_fail "Count filter (got $count messages, expected ≤5)"
    fi
}

test_time_filter_minutes() {
    if [[ -z "$TEST_PASSWORD" ]]; then
        log_test "Time filter minutes (skipped - no password)"
        return 0
    fi
    
    log_test "Time filter (-t 10m)"
    
    local output
    output=$(export MEESHY_PASSWORD="$TEST_PASSWORD" && "$MMR_SCRIPT" -t 10m -f json 2>/dev/null)
    
    assert_json_valid "$output" "Time filter (minutes) returns valid JSON"
}

test_time_filter_hours() {
    if [[ -z "$TEST_PASSWORD" ]]; then
        log_test "Time filter hours (skipped - no password)"
        return 0
    fi
    
    log_test "Time filter (-t 2h)"
    
    local output
    output=$(export MEESHY_PASSWORD="$TEST_PASSWORD" && "$MMR_SCRIPT" -t 2h -f json 2>/dev/null)
    
    assert_json_valid "$output" "Time filter (hours) returns valid JSON"
}

test_time_filter_days() {
    if [[ -z "$TEST_PASSWORD" ]]; then
        log_test "Time filter days (skipped - no password)"
        return 0
    fi
    
    log_test "Time filter (-t 1d)"
    
    local output
    output=$(export MEESHY_PASSWORD="$TEST_PASSWORD" && "$MMR_SCRIPT" -t 1d -f json 2>/dev/null)
    
    assert_json_valid "$output" "Time filter (days) returns valid JSON"
}

test_json_format() {
    if [[ -z "$TEST_PASSWORD" ]]; then
        log_test "JSON format (skipped - no password)"
        return 0
    fi
    
    log_test "JSON output format"
    
    local output
    output=$(export MEESHY_PASSWORD="$TEST_PASSWORD" && "$MMR_SCRIPT" -n 2 -f json 2>/dev/null)
    
    assert_json_valid "$output" "JSON format produces valid JSON"
    
    # Check JSON structure
    local has_content
    has_content=$(echo "$output" | jq -r '.[0].content // empty' 2>/dev/null)
    
    if [[ -n "$has_content" ]]; then
        log_pass "JSON contains message content"
    else
        log_fail "JSON missing message content"
    fi
}

test_compact_format() {
    if [[ -z "$TEST_PASSWORD" ]]; then
        log_test "Compact format (skipped - no password)"
        return 0
    fi
    
    log_test "Compact output format"
    
    local output
    output=$(export MEESHY_PASSWORD="$TEST_PASSWORD" && "$MMR_SCRIPT" -n 2 -f compact 2>&1)
    
    assert_contains "$output" "\\[" "Compact format has timestamps"
}

test_raw_format() {
    if [[ -z "$TEST_PASSWORD" ]]; then
        log_test "Raw format (skipped - no password)"
        return 0
    fi
    
    log_test "Raw output format"
    
    local output
    output=$(export MEESHY_PASSWORD="$TEST_PASSWORD" && "$MMR_SCRIPT" -n 1 -f raw 2>/dev/null)
    
    if [[ -n "$output" ]]; then
        log_pass "Raw format produces output"
    else
        log_fail "Raw format produces no output"
    fi
}

test_pretty_format() {
    if [[ -z "$TEST_PASSWORD" ]]; then
        log_test "Pretty format (skipped - no password)"
        return 0
    fi
    
    log_test "Pretty output format"
    
    local output
    output=$(export MEESHY_PASSWORD="$TEST_PASSWORD" && "$MMR_SCRIPT" -n 1 -f pretty 2>&1)
    
    assert_contains "$output" "From:" "Pretty format has 'From:'"
    assert_contains "$output" "Time:" "Pretty format has 'Time:'"
}

test_invalid_count() {
    log_test "Invalid count value"
    
    local exit_code=0
    "$MMR_SCRIPT" -n abc 2>/dev/null || exit_code=$?
    
    assert_exit_code 65 "$exit_code" "Invalid count returns data error"
}

test_invalid_time_format() {
    log_test "Invalid time format"
    
    local exit_code=0
    "$MMR_SCRIPT" -t 10 2>/dev/null || exit_code=$?
    
    assert_exit_code 64 "$exit_code" "Invalid time format returns usage error"
}

test_invalid_time_unit() {
    log_test "Invalid time unit"
    
    local exit_code=0
    "$MMR_SCRIPT" -t 10x 2>/dev/null || exit_code=$?
    
    assert_exit_code 65 "$exit_code" "Invalid time unit returns data error"
}

test_show_metadata_option() {
    if [[ -z "$TEST_PASSWORD" ]]; then
        log_test "Show metadata option (skipped - no password)"
        return 0
    fi
    
    log_test "Show metadata option"
    
    local output
    output=$(export MEESHY_PASSWORD="$TEST_PASSWORD" && "$MMR_SCRIPT" -n 1 --show-metadata 2>&1)
    
    assert_contains "$output" "ID:" "Metadata shows message ID"
    assert_contains "$output" "Type:" "Metadata shows message type"
}

test_show_translations_option() {
    if [[ -z "$TEST_PASSWORD" ]]; then
        log_test "Show translations option (skipped - no password)"
        return 0
    fi
    
    log_test "Show translations option"
    
    local output
    output=$(export MEESHY_PASSWORD="$TEST_PASSWORD" && "$MMR_SCRIPT" -n 1 --show-translations 2>&1)
    
    # Just check it doesn't error - translations may or may not exist
    if [[ $? -eq 0 ]]; then
        log_pass "Show translations option works"
    else
        log_fail "Show translations option failed"
    fi
}

test_verbose_mode() {
    if [[ -z "$TEST_PASSWORD" ]]; then
        log_test "Verbose mode (skipped - no password)"
        return 0
    fi
    
    log_test "Verbose mode"
    
    local output
    output=$(export MEESHY_PASSWORD="$TEST_PASSWORD" && "$MMR_SCRIPT" -n 1 -v 2>&1)
    
    assert_contains "$output" "[DEBUG]" "Verbose mode shows debug messages"
}

test_jq_pipeline() {
    if [[ -z "$TEST_PASSWORD" ]]; then
        log_test "JQ pipeline (skipped - no password)"
        return 0
    fi
    
    log_test "JQ pipeline processing"
    
    local output
    output=$(export MEESHY_PASSWORD="$TEST_PASSWORD" && "$MMR_SCRIPT" -n 2 -f json 2>/dev/null | jq -r '.[0].content // empty')
    
    if [[ -n "$output" ]]; then
        log_pass "JQ pipeline works"
    else
        log_fail "JQ pipeline failed"
    fi
}

#########################################
# Main test execution
#########################################

main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║           MMR Test Suite - Meeshy Message Receiver            ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Check if script exists
    if [[ ! -f "$MMR_SCRIPT" ]]; then
        echo -e "${RED}Error: $MMR_SCRIPT not found${NC}"
        exit 1
    fi
    
    # Check if executable
    if [[ ! -x "$MMR_SCRIPT" ]]; then
        echo -e "${YELLOW}Warning: $MMR_SCRIPT not executable, making it executable${NC}"
        chmod +x "$MMR_SCRIPT"
    fi
    
    # Display test configuration
    echo -e "${BLUE}Test Configuration:${NC}"
    echo "  Script: $MMR_SCRIPT"
    echo "  Username: $TEST_USERNAME"
    echo "  Conversation: $TEST_CONVERSATION"
    
    if [[ -z "$TEST_PASSWORD" ]]; then
        echo -e "  Password: ${YELLOW}NOT SET (some tests will be skipped)${NC}"
        echo ""
        echo -e "${YELLOW}To run all tests, set MEESHY_PASSWORD environment variable${NC}"
    else
        echo -e "  Password: ${GREEN}SET${NC}"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Run tests
    test_help
    test_version
    test_missing_password
    test_invalid_count
    test_invalid_time_format
    test_invalid_time_unit
    
    # Tests requiring authentication
    test_count_filter
    test_time_filter_minutes
    test_time_filter_hours
    test_time_filter_days
    test_json_format
    test_compact_format
    test_raw_format
    test_pretty_format
    test_show_metadata_option
    test_show_translations_option
    test_verbose_mode
    test_jq_pipeline
    
    # Summary
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                        Test Summary                            ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "  Total Tests: $TESTS_RUN"
    echo -e "  ${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "  ${RED}Failed: $TESTS_FAILED${NC}"
    echo ""
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║                     ALL TESTS PASSED! ✓                        ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        exit 0
    else
        echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║                   SOME TESTS FAILED! ✗                         ║${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        exit 1
    fi
}

# Execute main
main "$@"
