require('dotenv').config();
const axios = require('axios');

async function testSteamParse() {
  const steamAppId = 262060; // Darkest Dungeon

  console.log('🔍 Testing Steam API parsing for Darkest Dungeon...\n');

  try {
    const response = await axios.get('https://store.steampowered.com/api/appdetails', {
      params: { appids: steamAppId }
    });

    const data = response.data[steamAppId];

    if (!data || !data.success) {
      console.log('❌ No data returned');
      return;
    }

    const steamData = data.data;

    console.log('📦 Raw controller_support field:');
    console.log('   Type:', typeof steamData.controller_support);
    console.log('   Value:', steamData.controller_support);
    console.log('   JSON:', JSON.stringify(steamData.controller_support, null, 2));

    // Test our parsing logic
    let support = '';

    if (typeof steamData.controller_support === 'string') {
      support = steamData.controller_support.toLowerCase();
    } else if (typeof steamData.controller_support === 'object') {
      support = JSON.stringify(steamData.controller_support).toLowerCase();
    }

    console.log('\n🔧 After parsing:');
    console.log('   support string:', support);
    console.log('   includes "full":', support.includes('full'));
    console.log('   includes "partial":', support.includes('partial'));
    console.log('   includes "controller":', support.includes('controller'));

    // Final result
    let result = 'none';
    if (support.includes('full')) {
      result = 'full';
    } else if (support.includes('partial')) {
      result = 'partial';
    } else if (support.includes('controller')) {
      result = 'partial';
    }

    console.log('\n✅ Final result:', result);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSteamParse();