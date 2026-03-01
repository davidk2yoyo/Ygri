import { supabase } from '../supabaseClient';

/**
 * Email Service - Gestión de threads de email
 */

/**
 * Obtener threads de email para un proveedor
 */
export async function getSupplierEmailThreads(supplierId, options = {}) {
  const {
    limit = 50,
    status = 'active',
    orderBy = 'last_received_at',
    orderDirection = 'desc'
  } = options;

  let query = supabase
    .from('email_threads')
    .select('*')
    .eq('type', 'supplier')
    .eq('supplier_id', supplierId);

  if (status) {
    query = query.eq('status', status);
  }

  query = query.order(orderBy, { ascending: orderDirection === 'asc' });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching supplier email threads:', error);
    throw error;
  }

  return data;
}

/**
 * Obtener threads de email para un cliente
 */
export async function getClientEmailThreads(clientId, options = {}) {
  const {
    limit = 50,
    status = 'active',
    orderBy = 'last_received_at',
    orderDirection = 'desc'
  } = options;

  let query = supabase
    .from('email_threads')
    .select('*')
    .eq('type', 'client')
    .eq('client_id', clientId);

  if (status) {
    query = query.eq('status', status);
  }

  query = query.order(orderBy, { ascending: orderDirection === 'asc' });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching client email threads:', error);
    throw error;
  }

  return data;
}

/**
 * Obtener mensajes individuales de un thread
 */
export async function getThreadMessages(threadId) {
  const { data, error } = await supabase
    .from('email_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('received_at', { ascending: true });

  if (error) {
    console.error('Error fetching thread messages:', error);
    throw error;
  }

  return data;
}

/**
 * Obtener todos los threads que necesitan respuesta
 */
export async function getThreadsNeedingResponse(type = null) {
  let query = supabase
    .from('email_threads')
    .select('*, suppliers(name), clients(name)')
    .eq('needs_response', true)
    .eq('status', 'active')
    .order('priority', { ascending: false })
    .order('last_received_at', { ascending: false });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching threads needing response:', error);
    throw error;
  }

  return data;
}

/**
 * Obtener threads urgentes
 */
export async function getUrgentThreads() {
  const { data, error } = await supabase
    .from('email_threads')
    .select('*, suppliers(name), clients(name)')
    .eq('priority', 'urgent')
    .eq('status', 'active')
    .order('last_received_at', { ascending: false });

  if (error) {
    console.error('Error fetching urgent threads:', error);
    throw error;
  }

  return data;
}

/**
 * Marcar thread como resuelto
 */
export async function markThreadAsResolved(threadId) {
  const { data, error } = await supabase
    .from('email_threads')
    .update({
      status: 'resolved',
      needs_response: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', threadId)
    .select()
    .single();

  if (error) {
    console.error('Error marking thread as resolved:', error);
    throw error;
  }

  return data;
}

/**
 * Actualizar estado de acción pendiente
 */
export async function updateActionItem(threadId, actionIndex, completed) {
  // Primero obtener el thread actual
  const { data: thread, error: fetchError } = await supabase
    .from('email_threads')
    .select('action_items')
    .eq('id', threadId)
    .single();

  if (fetchError) {
    console.error('Error fetching thread:', fetchError);
    throw fetchError;
  }

  // Actualizar el action item
  const actionItems = thread.action_items || [];
  if (actionItems[actionIndex]) {
    actionItems[actionIndex].completed = completed;
  }

  // Guardar de vuelta
  const { data, error } = await supabase
    .from('email_threads')
    .update({
      action_items: actionItems,
      updated_at: new Date().toISOString()
    })
    .eq('id', threadId)
    .select()
    .single();

  if (error) {
    console.error('Error updating action item:', error);
    throw error;
  }

  return data;
}

/**
 * Buscar threads por texto
 */
export async function searchThreads(searchText, type = null) {
  let query = supabase
    .from('email_threads')
    .select('*, suppliers(name), clients(name)');

  // Búsqueda en subject, summary, from_email
  query = query.or(
    `subject.ilike.%${searchText}%,summary.ilike.%${searchText}%,from_email.ilike.%${searchText}%`
  );

  if (type) {
    query = query.eq('type', type);
  }

  query = query.order('last_received_at', { ascending: false }).limit(50);

  const { data, error } = await query;

  if (error) {
    console.error('Error searching threads:', error);
    throw error;
  }

  return data;
}

/**
 * Obtener estadísticas de emails
 */
export async function getEmailStats(entityId, type) {
  const idField = type === 'supplier' ? 'supplier_id' : 'client_id';

  const { data, error } = await supabase
    .from('email_threads')
    .select('status, needs_response, priority')
    .eq(idField, entityId)
    .eq('type', type);

  if (error) {
    console.error('Error fetching email stats:', error);
    throw error;
  }

  const stats = {
    total: data.length,
    active: data.filter(t => t.status === 'active').length,
    resolved: data.filter(t => t.status === 'resolved').length,
    needsResponse: data.filter(t => t.needs_response).length,
    urgent: data.filter(t => t.priority === 'urgent').length,
    high: data.filter(t => t.priority === 'high').length
  };

  return stats;
}
