import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aqgbggisciuwnpgmixwp.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxZ2JnZ2lzY2l1d25wZ21peHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MDc4OTAsImV4cCI6MjA5NDE4Mzg5MH0.CZlcnDO1p63Hv5-7EkKwrGw72GqmNbjZMIqcxEu-GPg'

export const supabase = createClient(supabaseUrl, supabaseKey)
