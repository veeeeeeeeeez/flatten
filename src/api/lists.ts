import { supabase } from '../supabaseClient';
import { List } from '../types';

export async function fetchLists(): Promise<List[]> {
  const { data, error } = await supabase
    .from('lists')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addList(name: string): Promise<List> {
  const { data: { user } } = await supabase.auth.getUser();
  console.log("user.id", user && user.id);
  const { data, error } = await supabase
    .from('lists')
    .insert([{ name, user_id: user?.id }])
    .select();
  if (error) throw error;
  return data[0];
} 