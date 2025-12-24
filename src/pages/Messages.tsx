import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Mail, Send, Reply, User, Clock, CheckCircle } from 'lucide-react';

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  subject: string;
  message: string;
  priority: string;
  status: string;
  is_admin_message: boolean;
  read_at: string | null;
  created_at: string;
  reply_to_id: string | null;
  sender?: {
    full_name: string;
    email: string;
    role: string;
  };
  recipient?: {
    full_name: string;
    email: string;
  };
}

interface Contact {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Conversation {
  id: string;
  subject: string;
  lastMessage: Message;
  messages: Message[];
  otherParticipant: {
    id: string;
    name: string;
    email: string;
  };
  unreadCount: number;
}

export default function Messages() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    recipient_id: '',
    subject: '',
    message: '',
    priority: 'normal'
  });
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      const [messagesRes, contactsRes] = await Promise.all([
        supabase
          .from('messages')
          .select(`
            *,
            sender:profiles!messages_sender_id_fkey(full_name, email, role),
            recipient:profiles!messages_recipient_id_fkey(full_name, email)
          `)
          .eq('organization_id', profile.organization_id)
          .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
          .order('created_at', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .eq('organization_id', profile.organization_id)
          .neq('id', profile.id)
          .order('full_name')
      ]);

      if (messagesRes.error) throw messagesRes.error;
      if (contactsRes.error) throw contactsRes.error;

      setMessages(messagesRes.data || []);
      setContacts(contactsRes.data || []);

      organizeConversations(messagesRes.data || []);
    } catch (error) {
      console.error('Mesajlar yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const organizeConversations = (allMessages: Message[]) => {
    const conversationMap = new Map<string, Conversation>();

    allMessages.forEach((msg) => {
      const rootId = msg.reply_to_id || msg.id;
      const otherId = msg.sender_id === profile?.id ? msg.recipient_id : msg.sender_id;
      const otherPerson = msg.sender_id === profile?.id ? msg.recipient : msg.sender;

      const key = `${rootId}-${otherId}`;

      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          id: key,
          subject: msg.subject,
          lastMessage: msg,
          messages: [msg],
          otherParticipant: {
            id: otherId || '',
            name: otherPerson?.full_name || 'Bilinmeyen',
            email: otherPerson?.email || ''
          },
          unreadCount: 0
        });
      } else {
        const conv = conversationMap.get(key)!;
        conv.messages.push(msg);
        conv.lastMessage = msg;
      }
    });

    const convArray = Array.from(conversationMap.values());

    convArray.forEach(conv => {
      conv.unreadCount = conv.messages.filter(
        m => m.recipient_id === profile?.id && m.status === 'unread'
      ).length;
    });

    convArray.sort((a, b) =>
      new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );

    setConversations(convArray);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          organization_id: profile.organization_id,
          sender_id: profile.id,
          recipient_id: formData.recipient_id,
          subject: formData.subject,
          message: formData.message,
          priority: formData.priority,
          is_admin_message: profile.role === 'admin'
        });

      if (error) throw error;

      await loadData();
      handleCloseModal();
      alert('Mesaj başarıyla gönderildi!');
    } catch (error: any) {
      console.error('Mesaj gönderme hatası:', error);
      alert(error.message || 'Mesaj gönderilemedi');
    } finally {
      setSending(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id || !selectedConversation) return;

    const lastMsg = selectedConversation.lastMessage;
    const recipientId = lastMsg.sender_id === profile.id ? lastMsg.recipient_id : lastMsg.sender_id;

    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          organization_id: profile.organization_id,
          sender_id: profile.id,
          recipient_id: recipientId,
          subject: selectedConversation.subject,
          message: replyMessage,
          priority: lastMsg.priority,
          reply_to_id: lastMsg.reply_to_id || lastMsg.id,
          is_admin_message: profile.role === 'admin'
        });

      if (error) throw error;

      setReplyMessage('');
      await loadData();
    } catch (error: any) {
      console.error('Yanıt gönderme hatası:', error);
      alert(error.message || 'Yanıt gönderilemedi');
    } finally {
      setSending(false);
    }
  };

  const markConversationAsRead = async (conversation: Conversation) => {
    const unreadMessages = conversation.messages.filter(
      m => m.recipient_id === profile?.id && m.status === 'unread'
    );

    try {
      for (const msg of unreadMessages) {
        await supabase
          .from('messages')
          .update({
            status: 'read',
            read_at: new Date().toISOString()
          })
          .eq('id', msg.id);
      }
      await loadData();
    } catch (error) {
      console.error('Okundu işaretleme hatası:', error);
    }
  };

  const selectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    if (conversation.unreadCount > 0) {
      markConversationAsRead(conversation);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({
      recipient_id: '',
      subject: '',
      message: '',
      priority: 'normal'
    });
  };

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, { color: string; text: string }> = {
      low: { color: 'bg-slate-100 text-slate-700', text: 'Düşük' },
      normal: { color: 'bg-blue-100 text-blue-700', text: 'Normal' },
      high: { color: 'bg-orange-100 text-orange-700', text: 'Yüksek' },
      urgent: { color: 'bg-red-100 text-red-700', text: 'Acil' }
    };
    const badge = badges[priority] || badges.normal;
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Mesajlar</h1>
          <p className="text-slate-600 mt-1">
            Konuşmalarınızı görüntüleyin ve yanıt verin
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Send className="w-4 h-4 mr-2" />
          Yeni Mesaj
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
        <Card className="lg:col-span-1 overflow-hidden">
          <CardHeader>
            <h2 className="text-lg font-semibold">
              Konuşmalar
              {totalUnread > 0 && (
                <span className="ml-2 bg-red-500 text-white rounded-full px-2 py-0.5 text-xs">
                  {totalUnread}
                </span>
              )}
            </h2>
          </CardHeader>
          <CardBody className="p-0 overflow-y-auto max-h-[calc(100vh-350px)]">
            {conversations.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">Henüz konuşma bulunmuyor</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                      selectedConversation?.id === conv.id ? 'bg-blue-50' : ''
                    } ${conv.unreadCount > 0 ? 'bg-blue-50/50' : ''}`}
                    onClick={() => selectConversation(conv)}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-slate-400" />
                        <div className="font-medium text-slate-900">
                          {conv.otherParticipant.name}
                        </div>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="bg-red-500 text-white rounded-full px-2 py-0.5 text-xs">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className={`text-sm ml-7 ${conv.unreadCount > 0 ? 'font-semibold' : ''} text-slate-700 truncate`}>
                      {conv.subject}
                    </div>
                    <div className="text-xs text-slate-500 ml-7 truncate">
                      {conv.lastMessage.message}
                    </div>
                    <div className="text-xs text-slate-400 ml-7 mt-1">
                      {new Date(conv.lastMessage.created_at).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden flex flex-col">
          {selectedConversation ? (
            <>
              <CardHeader className="border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedConversation.subject}</h2>
                    <p className="text-sm text-slate-600">
                      {selectedConversation.otherParticipant.name} ({selectedConversation.otherParticipant.email})
                    </p>
                  </div>
                  {getPriorityBadge(selectedConversation.lastMessage.priority)}
                </div>
              </CardHeader>

              <CardBody className="flex-1 overflow-y-auto max-h-[calc(100vh-450px)] space-y-4">
                {selectedConversation.messages.map((msg, idx) => {
                  const isSent = msg.sender_id === profile?.id;
                  const isFirstFromSender = idx === 0 ||
                    selectedConversation.messages[idx - 1].sender_id !== msg.sender_id;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[75%] ${isSent ? 'order-2' : 'order-1'}`}>
                        {isFirstFromSender && (
                          <div className={`text-xs text-slate-600 mb-1 ${isSent ? 'text-right' : 'text-left'}`}>
                            {isSent ? 'Siz' : msg.sender?.full_name}
                          </div>
                        )}
                        <div
                          className={`rounded-lg p-3 ${
                            isSent
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-900'
                          }`}
                        >
                          <div className="text-sm whitespace-pre-wrap">{msg.message}</div>
                          <div className={`flex items-center gap-1 mt-1 text-xs ${
                            isSent ? 'text-blue-100' : 'text-slate-500'
                          }`}>
                            <Clock className="w-3 h-3" />
                            {new Date(msg.created_at).toLocaleTimeString('tr-TR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                            {isSent && msg.read_at && (
                              <>
                                <CheckCircle className="w-3 h-3 ml-1" />
                                Okundu
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardBody>

              <div className="border-t border-slate-200 p-4">
                <form onSubmit={handleReply} className="flex gap-2">
                  <input
                    type="text"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Mesajınızı yazın..."
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <Button type="submit" disabled={sending || !replyMessage.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <CardBody>
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <Mail className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p>Bir konuşma seçin veya yeni mesaj gönderin</p>
                </div>
              </div>
            </CardBody>
          )}
        </Card>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Yeni Mesaj"
      >
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Alıcı *
            </label>
            <select
              value={formData.recipient_id}
              onChange={(e) => setFormData({ ...formData, recipient_id: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Seçiniz...</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.full_name} - {contact.role === 'admin' ? 'Yönetici' : contact.role === 'manager' ? 'Müdür' : 'Kullanıcı'} ({contact.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Konu *
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Mesaj konusu"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Öncelik
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="low">Düşük</option>
              <option value="normal">Normal</option>
              <option value="high">Yüksek</option>
              <option value="urgent">Acil</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Mesaj *
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={6}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Mesajınızı yazın..."
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={sending} className="flex-1">
              <Send className="w-4 h-4 mr-2" />
              {sending ? 'Gönderiliyor...' : 'Gönder'}
            </Button>
            <Button type="button" variant="secondary" onClick={handleCloseModal} className="flex-1">
              İptal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
