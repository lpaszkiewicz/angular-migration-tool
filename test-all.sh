#!/bin/bash
# Test script for Angular Fixer

echo "======================================"
echo "Angular Fixer Test Suite"
echo "======================================"
echo ""

echo "1. Testing SCAN mode..."
echo "--------------------------------------"
npm run dev -- --scan --path "test/samples/**/*.ts"
echo ""

echo "2. Current issues detected. Press Enter to continue..."
read

echo ""
echo "3. Testing AUTO-FIX mode..."
echo "--------------------------------------"
npm run dev -- --fix --path "test/samples/**/*.ts"
echo ""

echo "4. Re-scanning to verify fixes..."
echo "--------------------------------------"
npm run dev -- --scan --path "test/samples/**/*.ts"
echo ""

echo "======================================"
echo "Test complete!"
echo "======================================"
echo ""
echo "To test INTERACTIVE mode, run:"
echo "  npm run interactive"
echo ""
