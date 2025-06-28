import { supabase } from '../supabaseClient';

export async function fetchLists() {
  const { data, error } = await supabase
    .from('lists')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function addList(name) {
    const { data: { user } } = await supabase.auth.getUser();
    console.log("user.id", user && user.id); // Should log a UUID string
    const { data, error } = await supabase
    .from('lists')
    .insert([{ name, user_id: user.id }])
    .select();
    if (error) throw error;
    return data[0];
}