const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../../.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
(async () => {
  const { data } = await supabase.from('novels').select('id, title, metadata').limit(5).order('created_at', { ascending: false });
  for (const n of data) {
    console.log(n.title, 'metadata keys:', n.metadata ? Object.keys(n.metadata) : 'null');
    if (n.metadata && n.metadata.outline) console.log('  outline keys:', Object.keys(n.metadata.outline));
  }
})();
