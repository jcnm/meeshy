#!/usr/bin/env node

/**
 * Test script pour vérifier l'API /anonymous/link/:identifier
 * Usage: node test-anonymous-link-api.js <linkId>
 */

const fetch = require('node-fetch');

async function testAnonymousLinkAPI(linkId) {
  const baseUrl = process.env.API_URL || 'http://localhost:3001';
  const url = `${baseUrl}/anonymous/link/${linkId}`;
  
  console.log(`🔗 Testing API: ${url}`);
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`📊 Status: ${response.status}`);
    console.log(`✅ Success: ${data.success}`);
    
    if (data.success && data.data) {
      console.log('\n📋 Link Data:');
      console.log(`  - ID: ${data.data.id}`);
      console.log(`  - Link ID: ${data.data.linkId}`);
      console.log(`  - Name: ${data.data.name || 'N/A'}`);
      console.log(`  - Description: ${data.data.description || 'N/A'}`);
      console.log(`  - Current Uses: ${data.data.currentUses}`);
      console.log(`  - Max Uses: ${data.data.maxUses || 'Unlimited'}`);
      
      if (data.data.stats) {
        console.log('\n📈 Statistics:');
        console.log(`  - Total Participants: ${data.data.stats.totalParticipants}`);
        console.log(`  - Members: ${data.data.stats.memberCount}`);
        console.log(`  - Anonymous: ${data.data.stats.anonymousCount}`);
        console.log(`  - Languages: ${data.data.stats.languageCount}`);
        console.log(`  - Spoken Languages: ${data.data.stats.spokenLanguages.join(', ')}`);
      }
      
      if (data.data.conversation) {
        console.log('\n💬 Conversation:');
        console.log(`  - Title: ${data.data.conversation.title}`);
        console.log(`  - Type: ${data.data.conversation.type}`);
        console.log(`  - Created: ${new Date(data.data.conversation.createdAt).toLocaleString()}`);
      }
      
      if (data.data.creator) {
        console.log('\n👤 Creator:');
        console.log(`  - Name: ${data.data.creator.displayName || data.data.creator.username}`);
        console.log(`  - Username: ${data.data.creator.username}`);
      }
    } else {
      console.log(`❌ Error: ${data.message}`);
    }
    
  } catch (error) {
    console.error(`💥 Request failed:`, error.message);
  }
}

// Récupérer le linkId depuis les arguments de ligne de commande
const linkId = process.argv[2];

if (!linkId) {
  console.log('❌ Usage: node test-anonymous-link-api.js <linkId>');
  console.log('📝 Example: node test-anonymous-link-api.js mshy_abc123def456');
  process.exit(1);
}

testAnonymousLinkAPI(linkId);
