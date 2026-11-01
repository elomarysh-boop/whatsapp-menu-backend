import { supabase, assertNoSupabaseError } from './supabase.js';

export async function getStoreByPhone(phoneNumber) {
  const result = await supabase.from('stores').select('*').eq('phone_number', phoneNumber).eq('is_active', true).maybeSingle();
  return assertNoSupabaseError(result, 'getStoreByPhone');
}

export async function getCategories(storeId) {
  const result = await supabase.from('categories').select('id,name,sort_order').eq('store_id', storeId).eq('is_active', true).order('sort_order').order('name');
  return assertNoSupabaseError(result, 'getCategories') ?? [];
}

export async function getCategoryByNumber(storeId, number) {
  const categories = await getCategories(storeId);
  return categories[number - 1] ?? null;
}

export async function getProducts(storeId, categoryId) {
  const result = await supabase.from('products').select('id,name,description,price,currency,sort_order').eq('store_id', storeId).eq('category_id', categoryId).eq('is_active', true).order('sort_order').order('name');
  return assertNoSupabaseError(result, 'getProducts') ?? [];
}

export async function getProductByNumber(storeId, categoryId, number) {
  const products = await getProducts(storeId, categoryId);
  return products[number - 1] ?? null;
}

export async function insertOrder(order) {
  const result = await supabase.from('orders').insert(order).select('id,order_number,status,created_at').single();
  return assertNoSupabaseError(result, 'insertOrder');
}
