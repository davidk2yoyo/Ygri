import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Inbox,
  Mail,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  MessageSquare,
  Calendar,
  Tag,
  CheckSquare,
  Square,
  ArrowDownCircle,
  ArrowUpCircle
} from 'lucide-react';
import {
  getSupplierEmailThreads,
  getClientEmailThreads,
  markThreadAsResolved,
  updateActionItem,
  getEmailStats
} from '../services/emailService';

/**
 * EmailHistoryTab - Componente para mostrar historial de emails
 * Usado en SuppliersPage y ClientsPage
 */
export default function EmailHistoryTab({ entityId, entityType }) {
  const { t } = useTranslation();
  const [threads, setThreads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState(null);
  const [filter, setFilter] = useState('active'); // active, resolved, all

  useEffect(() => {
    loadThreads();
    loadStats();
  }, [entityId, entityType, filter]);

  const loadThreads = async () => {
    try {
      setLoading(true);
      const fetchFn = entityType === 'supplier' ? getSupplierEmailThreads : getClientEmailThreads;
      const data = await fetchFn(entityId, {
        status: filter === 'all' ? null : filter,
        limit: 100
      });
      setThreads(data);
    } catch (error) {
      console.error('Error loading email threads:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await getEmailStats(entityId, entityType);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleMarkResolved = async (threadId) => {
    try {
      await markThreadAsResolved(threadId);
      loadThreads();
      loadStats();
      if (selectedThread?.id === threadId) {
        setSelectedThread(null);
      }
    } catch (error) {
      console.error('Error marking thread as resolved:', error);
    }
  };

  const handleToggleActionItem = async (threadId, actionIndex, currentStatus) => {
    try {
      await updateActionItem(threadId, actionIndex, !currentStatus);
      loadThreads();
      // Update selected thread if open
      if (selectedThread?.id === threadId) {
        const updated = threads.find(t => t.id === threadId);
        if (updated) {
          updated.action_items[actionIndex].completed = !currentStatus;
          setSelectedThread(updated);
        }
      }
    } catch (error) {
      console.error('Error updating action item:', error);
    }
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-50';
      case 'urgent': return 'text-red-600 bg-red-50';
      case 'negative': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      normal: 'bg-blue-100 text-blue-800',
      low: 'bg-gray-100 text-gray-800'
    };
    return colors[priority] || colors.normal;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando historial de emails...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <div className="text-xs text-blue-600">Activos</div>
            <div className="text-xl font-bold text-blue-900">{stats.active}</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
            <div className="text-xs text-green-600">Resueltos</div>
            <div className="text-xl font-bold text-green-900">{stats.resolved}</div>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
            <div className="text-xs text-orange-600">Requieren Respuesta</div>
            <div className="text-xl font-bold text-orange-900">{stats.needsResponse}</div>
          </div>
          <div className="bg-red-50 p-3 rounded-lg border border-red-200">
            <div className="text-xs text-red-600">Urgentes</div>
            <div className="text-xl font-bold text-red-900">{stats.urgent}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === 'active'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Activos
        </button>
        <button
          onClick={() => setFilter('resolved')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === 'resolved'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Resueltos
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Todos
        </button>
      </div>

      {/* Threads List */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-auto">
        {/* Lista de threads */}
        <div className="space-y-3 lg:max-h-[600px] lg:overflow-y-auto">
          {threads.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Inbox className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p>No hay emails en esta categoría</p>
            </div>
          ) : (
            threads.map((thread) => (
              <div
                key={thread.id}
                onClick={() => setSelectedThread(thread)}
                className={`bg-white p-4 rounded-lg border cursor-pointer transition hover:shadow-md ${
                  selectedThread?.id === thread.id
                    ? 'border-blue-500 shadow-md'
                    : 'border-gray-200'
                } ${thread.needs_response ? 'border-l-4 border-l-orange-500' : ''}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {/* Direction Badge */}
                      {thread.direction === 'incoming' ? (
                        <ArrowDownCircle className="h-4 w-4 text-blue-500" title="Recibido" />
                      ) : (
                        <ArrowUpCircle className="h-4 w-4 text-green-500" title="Enviado" />
                      )}
                      {thread.needs_response && (
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                      )}
                      <h3 className="font-medium text-gray-900 line-clamp-1">
                        {thread.subject}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600">{thread.from_name || thread.from_email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityBadge(thread.priority)}`}>
                      {thread.priority}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      thread.direction === 'incoming'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {thread.direction === 'incoming' ? '📥 Recibido' : '📤 Enviado'}
                    </span>
                  </div>
                </div>

                {/* Summary */}
                <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                  {thread.summary}
                </p>

                {/* Footer */}
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(thread.last_received_at).toLocaleDateString('es')}
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {thread.message_count || 1}
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded ${getSentimentColor(thread.sentiment)}`}>
                    {thread.sentiment}
                  </div>
                </div>

                {/* Key Topics */}
                {thread.key_topics && thread.key_topics.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {thread.key_topics.slice(0, 3).map((topic, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Thread Detail */}
        <div className="lg:sticky lg:top-0">
          {selectedThread ? (
            <div className="bg-white p-6 rounded-lg border border-gray-200 lg:max-h-[600px] lg:overflow-y-auto">
              {/* Header */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <h2 className="text-lg font-bold text-gray-900 flex-1">
                    {selectedThread.subject}
                  </h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    selectedThread.direction === 'incoming'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {selectedThread.direction === 'incoming' ? '📥 Recibido' : '📤 Enviado'}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span className="font-medium">De:</span>
                    <span>{selectedThread.from_email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span className="font-medium">Para:</span>
                    <span>{selectedThread.to_email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    <span>{new Date(selectedThread.last_received_at).toLocaleString('es')}</span>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Resumen IA</h3>
                <p className="text-gray-700">{selectedThread.summary}</p>
              </div>

              {/* Last Message */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Último Mensaje</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {selectedThread.last_message}
                </p>
              </div>

              {/* Action Items */}
              {selectedThread.action_items && selectedThread.action_items.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Acciones Pendientes
                  </h3>
                  <div className="space-y-2">
                    {selectedThread.action_items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-2 bg-blue-50 rounded border border-blue-200"
                      >
                        <button
                          onClick={() => handleToggleActionItem(
                            selectedThread.id,
                            idx,
                            item.completed
                          )}
                          className="mt-0.5"
                        >
                          {item.completed ? (
                            <CheckSquare className="h-5 w-5 text-green-600" />
                          ) : (
                            <Square className="h-5 w-5 text-gray-400" />
                          )}
                        </button>
                        <div className="flex-1">
                          <p className={`text-sm ${item.completed ? 'line-through text-gray-500' : 'text-gray-700'}`}>
                            {item.task}
                          </p>
                          {item.deadline && (
                            <p className="text-xs text-gray-500 mt-1">
                              Deadline: {item.deadline}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Topics */}
              {selectedThread.key_topics && selectedThread.key_topics.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Temas Clave</h3>
                  <div className="flex gap-2 flex-wrap">
                    {selectedThread.key_topics.map((topic, idx) => (
                      <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Data */}
              {selectedThread.extracted_data && Object.keys(selectedThread.extracted_data).length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Datos Extraídos</h3>
                  <div className="bg-gray-50 p-3 rounded text-xs font-mono">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(selectedThread.extracted_data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Actions */}
              {selectedThread.status === 'active' && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleMarkResolved(selectedThread.id)}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="h-5 w-5" />
                    Marcar como Resuelto
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 p-12 rounded-lg border border-gray-200 text-center text-gray-500">
              <Mail className="mx-auto h-12 w-12 mb-3 opacity-30" />
              <p>Selecciona un email para ver los detalles</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
