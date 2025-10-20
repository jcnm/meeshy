#!/usr/bin/env node

/**
 * Test script to verify the new code file types are properly supported
 */

const { 
  isCodeMimeType, 
  getAttachmentType, 
  getSizeLimit,
  ACCEPTED_MIME_TYPES,
  UPLOAD_LIMITS
} = require('./shared/types/attachment');

console.log('🧪 Testing Code File Type Support\n');
console.log('=====================================\n');

// Test MIME types for code files
const codeTestCases = [
  { ext: '.md', mimeType: 'text/markdown', expected: true },
  { ext: '.sh', mimeType: 'application/x-sh', expected: true },
  { ext: '.js', mimeType: 'text/javascript', expected: true },
  { ext: '.ts', mimeType: 'text/typescript', expected: true },
  { ext: '.py', mimeType: 'text/x-python', expected: true },
];

console.log('📋 Accepted Code MIME Types:');
console.log(ACCEPTED_MIME_TYPES.CODE);
console.log('\n');

console.log('✅ Testing MIME Type Recognition:');
codeTestCases.forEach(test => {
  const isCode = isCodeMimeType(test.mimeType);
  const attachmentType = getAttachmentType(test.mimeType);
  const sizeLimit = getSizeLimit(attachmentType);
  const sizeLimitMB = (sizeLimit / 1024 / 1024).toFixed(0);
  
  console.log(`  ${test.ext}: ${test.mimeType}`);
  console.log(`    - Is Code Type: ${isCode ? '✅' : '❌'} (expected: ${test.expected ? '✅' : '❌'})`);
  console.log(`    - Attachment Type: ${attachmentType}`);
  console.log(`    - Size Limit: ${sizeLimitMB}MB`);
  console.log('');
});

console.log('📊 Upload Limits:');
Object.entries(UPLOAD_LIMITS).forEach(([type, limit]) => {
  const limitMB = (limit / 1024 / 1024).toFixed(0);
  console.log(`  ${type}: ${limitMB}MB`);
});

console.log('\n🎯 File Input Accept Attribute:');
console.log('  Current: accept="image/*,video/*,audio/*,application/pdf,text/plain,.doc,.docx,.ppt,.pptx,.md,.sh,.js,.ts,.py"');

console.log('\n✨ Test Complete!');