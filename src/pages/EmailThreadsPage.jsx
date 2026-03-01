import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import {
  Inbox,
  AlertCircle,
  User,
  Building2,
  Mail,
  ChevronDown,
  ChevronUp,
  Clock,
  Tag,
  MessageSquare
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const EmailThreadsPage = () => {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedThreads, setExpandedThreads] = useState(new Set());
  const [filterStatus, setFilterStatus] = useState('all'); // all, urgent, active
  const [filterType, setFilterType] = useState('all'); // all, client, supplier

  useEffect(() => {
    fetchThreads();
  }, [filterStatus, filterType]);

  const fetchThreads = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('email_threads')
        .select('*')
        .order('last_received_at', { ascending: false });

      if (filterStatus === 'urgent') {
        query = query.eq('priority', 'urgent');
      } else if (filterStatus === 'active') {
        query = query.eq('status', 'active');
      }

      if (filterType === 'client') {
        query = query.eq('type', 'client');
      } else if (filterType === 'supplier') {
        query = query.eq('type', 'supplier');
      }

      const { data, error } = await query;

      console.log('Email threads data:', data);
      console.log('Email threads error:', error);

      // Debug: log first thread structure
      if (data && data.length > 0) {
        console.log('First thread structure:', data[0]);
        console.log('Type:', data[0].type);
        console.log('Client ID:', data[0].client_id);
        console.log('Supplier ID:', data[0].supplier_id);
      }

      if (error) {
        console.error('Supabase error:', error);
      }

      if (!error && data) {
        // Fetch related supplier/client data
        const threadsWithEntities = await Promise.all(
          data.map(async (thread) => {
            try {
              if (thread.type === 'supplier' && thread.supplier_id) {
                const { data: supplier, error: supplierError } = await supabase
                  .from('suppliers')
                  .select('name, contact_person')
                  .eq('id', thread.supplier_id)
                  .single();

                if (!supplierError && supplier) {
                  return { ...thread, supplier };
                }
              } else if (thread.type === 'client' && thread.client_id) {
                const { data: client, error: clientError } = await supabase
                  .from('clients')
                  .select('company_name, contact_person')
                  .eq('id', thread.client_id)
                  .single();

                if (!clientError && client) {
                  return { ...thread, client: { ...client, name: client.company_name } };
                }
              }
            } catch (err) {
              console.error('Error fetching entity:', err);
            }
            return thread;
          })
        );

        console.log('Threads with entities:', threadsWithEntities);
        setThreads(threadsWithEntities);
      }
    } catch (err) {
      console.error('Error fetching threads:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleThread = async (threadId, threadUuid) => {
    const newExpanded = new Set(expandedThreads);
    if (newExpanded.has(threadId)) {
      newExpanded.delete(threadId);
    } else {
      newExpanded.add(threadId);
      // Fetch messages if not loaded yet
      if (!threads.find(t => t.id === threadUuid)?.messages) {
        const { data } = await supabase
          .from('email_messages')
          .select('*')
          .eq('thread_id', threadUuid)
          .order('received_at', { ascending: true });

        setThreads(prev => prev.map(t =>
          t.id === threadUuid ? { ...t, messages: data || [] } : t
        ));
      }
    }
    setExpandedThreads(newExpanded);
  };

  // Gradient colors based on priority/urgency
  const getGradient = (thread) => {
    if (thread.priority === 'urgent') {
      return 'bg-gradient-to-br from-red-500 via-pink-500 to-purple-500';
    } else if (thread.priority === 'high') {
      return 'bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-400';
    } else if (thread.sentiment === 'negative') {
      return 'bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500';
    } else {
      return 'bg-gradient-to-br from-emerald-400 via-cyan-400 to-blue-400';
    }
  };

  const getAccentColor = (thread) => {
    if (thread.priority === 'urgent') return 'border-red-500 bg-red-50';
    if (thread.priority === 'high') return 'border-orange-500 bg-orange-50';
    if (thread.sentiment === 'negative') return 'border-indigo-500 bg-indigo-50';
    return 'border-emerald-500 bg-emerald-50';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Email Timeline
            </h1>
            <p className="text-slate-600 mt-1">Detailed visual representation of email conversations</p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-all">
              <Tag className="w-4 h-4 inline mr-2" />
              Filter
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex gap-2 bg-white rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-md transition-all ${
                filterStatus === 'all'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('urgent')}
              className={`px-4 py-2 rounded-md transition-all ${
                filterStatus === 'urgent'
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Urgent
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-4 py-2 rounded-md transition-all ${
                filterStatus === 'active'
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Active
            </button>
          </div>

          <div className="flex gap-2 bg-white rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-md transition-all ${
                filterType === 'all'
                  ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setFilterType('client')}
              className={`px-4 py-2 rounded-md transition-all ${
                filterType === 'client'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Clients
            </button>
            <button
              onClick={() => setFilterType('supplier')}
              className={`px-4 py-2 rounded-md transition-all ${
                filterType === 'supplier'
                  ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Suppliers
            </button>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="max-w-6xl mx-auto">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
            <Inbox className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg">No email threads found</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-200 via-purple-200 to-pink-200"></div>

            <div className="space-y-6">
              {threads.map((thread, index) => {
                const isExpanded = expandedThreads.has(thread.thread_id);
                const entityName = thread.type === 'client'
                  ? thread.client?.name
                  : thread.supplier?.name;
                const contactPerson = thread.type === 'client'
                  ? thread.client?.contact_person
                  : thread.supplier?.contact_person;

                return (
                  <div key={thread.id} className="relative pl-20">
                    {/* Timeline dot */}
                    <div className={`absolute left-6 top-6 w-5 h-5 rounded-full ${getGradient(thread)} shadow-lg border-4 border-white`}></div>

                    {/* Card */}
                    <div
                      className={`bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border-l-4 ${getAccentColor(thread)}`}
                    >
                      {/* Card Header */}
                      <div
                        className="p-6 cursor-pointer"
                        onClick={() => toggleThread(thread.thread_id, thread.id)}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-start gap-4 flex-1">
                            {/* Avatar */}
                            <div className={`w-12 h-12 rounded-xl ${getGradient(thread)} flex items-center justify-center text-white font-bold shadow-md`}>
                              {thread.type === 'client' ? (
                                <User className="w-6 h-6" />
                              ) : (
                                <Building2 className="w-6 h-6" />
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-slate-900 text-lg truncate">
                                  {thread.subject}
                                </h3>
                                {thread.priority === 'urgent' && (
                                  <span className="px-2 py-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-md animate-pulse">
                                    URGENT
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-sm text-slate-600 mb-2">
                                <span className="font-medium">{entityName || 'Unknown'}</span>
                                <span className="text-slate-400">•</span>
                                <span>{contactPerson || thread.from_name}</span>
                                <span className="text-slate-400">•</span>
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  {thread.message_count} message{thread.message_count > 1 ? 's' : ''}
                                </span>
                              </div>

                              <p className="text-slate-600 text-sm line-clamp-2">
                                {thread.last_message}
                              </p>

                              {thread.summary && (
                                <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                                  <p className="text-sm text-slate-700 italic">{thread.summary}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right side - time & expand */}
                          <div className="flex flex-col items-end gap-2 ml-4">
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDistanceToNow(new Date(thread.last_received_at), { addSuffix: true })}
                            </span>
                            <div className="flex items-center gap-2">
                              {thread.type === 'client' ? (
                                <span className="px-3 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 text-xs font-medium rounded-full">
                                  Client
                                </span>
                              ) : (
                                <span className="px-3 py-1 bg-gradient-to-r from-violet-100 to-purple-100 text-purple-700 text-xs font-medium rounded-full">
                                  Supplier
                                </span>
                              )}
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Messages */}
                      {isExpanded && thread.messages && (
                        <div className="border-t border-slate-100 bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
                          <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Message History
                          </h4>
                          <div className="space-y-3">
                            {thread.messages.map((msg, idx) => (
                              <div
                                key={msg.id}
                                className="bg-white rounded-lg p-4 shadow-sm border border-slate-100"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-slate-900 text-sm">
                                    {msg.from_name || msg.from_email}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {format(new Date(msg.received_at), 'MMM d, yyyy h:mm a')}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                                  {msg.body_text}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailThreadsPage;
