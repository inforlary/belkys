import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import {
  Mail,
  Send,
  Reply,
  Inbox,
  Archive,
  Star,
  Trash2,
  Search,
  Paperclip,
  X,
  CheckCheck,
  MoreVertical,
  Edit3,
  Users,
  Clock,
  Filter
} from 'lucide-react';

interface Message {
  id: string;
  thread_id: string | null;
  sender_id: string;
  recipient_id: string;
  subject: string;
  message: string;
  priority: string;
  read_at: string | null;
  is_archived: boolean;
  is_starred: boolean;
  is_deleted: boolean;
  created_at: string;
  sender?: {
    full_name: string;
    email: string;
    role: string;
  };
  recipient?: {
    full_name: string;
    email: string;
  };
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
  read_receipts?: ReadReceipt[];
}

interface MessageAttachment {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
}

interface MessageReaction {
  id: string;
  user_id: string;
  reaction: string;
  user?: {
    full_name: string;
  };
}

interface ReadReceipt {
  id: string;
  user_id: string;
  read_at: string;
  user?: {
    full_name: string;
  };
}

interface Contact {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

type ViewMode = 'inbox' | 'sent' | 'starred' | 'archived' | 'drafts';

export default function MessagesEnhanced() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('inbox');
  const [loading, setLoading] = useState(true);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [composeData, setComposeData] = useState({
    recipient_id: '',
    subject: '',
    message: '',
    priority: 'normal',
    attachments: [] as File[]
  });

  const [replyData, setReplyData] = useState({
    message: '',
    attachments: [] as File[]
  });

  useEffect(() => {
    if (profile?.id) {
      loadData();
      loadUnreadCount();

      const channel = supabase
        .channel('messages-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `recipient_id=eq.${profile.id}`
          },
          () => {
            loadData();
            loadUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile, viewMode]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    setLoading(true);
    try {
      let query = supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(full_name, email, role),
          recipient:profiles!messages_recipient_id_fkey(full_name, email, role)
        `)
        .eq('organization_id', profile.organization_id)
        .eq('is_deleted', false);

      if (viewMode === 'inbox') {
        query = query.eq('recipient_id', profile.id).eq('is_archived', false);
      } else if (viewMode === 'sent') {
        query = query.eq('sender_id', profile.id).eq('is_archived', false);
      } else if (viewMode === 'starred') {
        query = query.or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`).eq('is_starred', true);
      } else if (viewMode === 'archived') {
        query = query.or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`).eq('is_archived', true);
      }

      if (searchTerm) {
        query = query.or(`subject.ilike.%${searchTerm}%,message.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);

      const { data: contactsData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('organization_id', profile.organization_id)
        .neq('id', profile.id)
        .order('full_name');

      setContacts(contactsData || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const { data } = await supabase.rpc('get_unread_message_count');
      setUnreadCount(data || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!profile?.organization_id || !composeData.recipient_id || !composeData.message) {
      alert('Lütfen alıcı ve mesaj giriniz.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          organization_id: profile.organization_id,
          sender_id: profile.id,
          recipient_id: composeData.recipient_id,
          subject: composeData.subject || 'Konu yok',
          message: composeData.message,
          priority: composeData.priority,
          status: 'unread'
        })
        .select()
        .single();

      if (error) throw error;

      if (composeData.attachments.length > 0 && data) {
        await uploadAttachments(data.id, composeData.attachments);
      }

      alert('Mesaj gönderildi!');
      setShowComposeModal(false);
      setComposeData({
        recipient_id: '',
        subject: '',
        message: '',
        priority: 'normal',
        attachments: []
      });
      loadData();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Mesaj gönderilirken bir hata oluştu.');
    }
  };

  const handleReply = async () => {
    if (!selectedMessage || !replyData.message) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          organization_id: profile?.organization_id,
          sender_id: profile?.id,
          recipient_id: selectedMessage.sender_id,
          subject: `Re: ${selectedMessage.subject}`,
          message: replyData.message,
          priority: selectedMessage.priority,
          status: 'unread',
          reply_to_id: selectedMessage.id,
          thread_id: selectedMessage.thread_id
        })
        .select()
        .single();

      if (error) throw error;

      if (replyData.attachments.length > 0 && data) {
        await uploadAttachments(data.id, replyData.attachments);
      }

      alert('Yanıt gönderildi!');
      setReplyData({ message: '', attachments: [] });
      loadData();
    } catch (error) {
      console.error('Error replying:', error);
      alert('Yanıt gönderilirken bir hata oluştu.');
    }
  };

  const uploadAttachments = async (messageId: string, files: File[]) => {
    for (const file of files) {
      const fileName = `${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        continue;
      }

      await supabase.from('message_attachments').insert({
        message_id: messageId,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        storage_path: fileName,
        uploaded_by: profile?.id
      });
    }
  };

  const handleMarkAsRead = async (message: Message) => {
    if (message.read_at || message.recipient_id !== profile?.id) return;

    try {
      await supabase.rpc('mark_message_as_read', { message_uuid: message.id });
      loadData();
      loadUnreadCount();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleToggleStar = async (message: Message) => {
    try {
      await supabase.rpc('toggle_message_star', { message_uuid: message.id });
      loadData();
    } catch (error) {
      console.error('Error toggling star:', error);
    }
  };

  const handleToggleArchive = async (message: Message) => {
    try {
      await supabase.rpc('toggle_message_archive', { message_uuid: message.id });
      loadData();
    } catch (error) {
      console.error('Error toggling archive:', error);
    }
  };

  const handleDelete = async (message: Message) => {
    if (!confirm('Bu mesajı silmek istediğinizden emin misiniz?')) return;

    try {
      await supabase.rpc('soft_delete_message', { message_uuid: message.id });
      setSelectedMessage(null);
      loadData();
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handleSelectMessage = (message: Message) => {
    setSelectedMessage(message);
    if (message.recipient_id === profile?.id && !message.read_at) {
      handleMarkAsRead(message);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isReply: boolean = false) => {
    const files = Array.from(e.target.files || []);
    if (isReply) {
      setReplyData({ ...replyData, attachments: [...replyData.attachments, ...files] });
    } else {
      setComposeData({ ...composeData, attachments: [...composeData.attachments, ...files] });
    }
  };

  const removeAttachment = (index: number, isReply: boolean = false) => {
    if (isReply) {
      setReplyData({
        ...replyData,
        attachments: replyData.attachments.filter((_, i) => i !== index)
      });
    } else {
      setComposeData({
        ...composeData,
        attachments: composeData.attachments.filter((_, i) => i !== index)
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'text-gray-500',
      normal: 'text-blue-500',
      high: 'text-orange-500',
      urgent: 'text-red-500'
    };
    return colors[priority] || 'text-gray-500';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="h-screen flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-8 h-8 text-blue-600" />
            Mesajlar
          </h1>
          <p className="text-gray-600 mt-1">
            Kullanıcılarla iletişim kurun ve mesajlarınızı yönetin
          </p>
        </div>
        <Button onClick={() => setShowComposeModal(true)} icon={Edit3}>
          Yeni Mesaj
        </Button>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        <Card className="w-64 flex-shrink-0">
          <CardBody className="p-0">
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Mesaj ara..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <nav className="p-2">
              <button
                onClick={() => setViewMode('inbox')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  viewMode === 'inbox'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Inbox className="w-4 h-4" />
                  Gelen Kutusu
                </span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setViewMode('sent')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  viewMode === 'sent'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Send className="w-4 h-4" />
                Gönderilenler
              </button>

              <button
                onClick={() => setViewMode('starred')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  viewMode === 'starred'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Star className="w-4 h-4" />
                Yıldızlılar
              </button>

              <button
                onClick={() => setViewMode('archived')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  viewMode === 'archived'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Archive className="w-4 h-4" />
                Arşiv
              </button>
            </nav>
          </CardBody>
        </Card>

        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardBody className="flex-1 flex overflow-hidden p-0">
            <div className="w-1/3 border-r overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Mail className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Mesaj bulunamadı</p>
                </div>
              ) : (
                messages.map((message) => (
                  <button
                    key={message.id}
                    onClick={() => handleSelectMessage(message)}
                    className={`w-full p-4 border-b text-left hover:bg-gray-50 transition-colors ${
                      selectedMessage?.id === message.id ? 'bg-blue-50' : ''
                    } ${!message.read_at && message.recipient_id === profile?.id ? 'bg-blue-50/30' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className={`font-medium ${!message.read_at && message.recipient_id === profile?.id ? 'font-bold' : ''}`}>
                        {viewMode === 'sent' ? message.recipient?.full_name : message.sender?.full_name}
                      </span>
                      <div className="flex items-center gap-1">
                        {message.is_starred && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                        {message.read_at && message.sender_id === profile?.id && (
                          <CheckCheck className="w-3 h-3 text-blue-500" />
                        )}
                      </div>
                    </div>
                    <p className={`text-sm mb-1 ${!message.read_at && message.recipient_id === profile?.id ? 'font-semibold' : 'text-gray-700'}`}>
                      {message.subject}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{message.message}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400">
                        {new Date(message.created_at).toLocaleDateString('tr-TR')}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${getPriorityColor(message.priority)}`} />
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedMessage ? (
                <>
                  <div className="p-4 border-b bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-gray-900 mb-1">
                          {selectedMessage.subject}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {viewMode === 'sent' ? selectedMessage.recipient?.full_name : selectedMessage.sender?.full_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {new Date(selectedMessage.created_at).toLocaleString('tr-TR')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleStar(selectedMessage)}
                          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                          title={selectedMessage.is_starred ? 'Yıldızı Kaldır' : 'Yıldızla'}
                        >
                          <Star
                            className={`w-5 h-5 ${
                              selectedMessage.is_starred
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-gray-400'
                            }`}
                          />
                        </button>
                        <button
                          onClick={() => handleToggleArchive(selectedMessage)}
                          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                          title={selectedMessage.is_archived ? 'Arşivden Çıkar' : 'Arşivle'}
                        >
                          <Archive className="w-5 h-5 text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleDelete(selectedMessage)}
                          className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="w-5 h-5 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="prose max-w-none">
                      <p className="text-gray-800 whitespace-pre-wrap">{selectedMessage.message}</p>
                    </div>
                  </div>

                  {viewMode === 'inbox' && (
                    <div className="p-4 border-t bg-gray-50">
                      <div className="flex items-start gap-3">
                        <textarea
                          value={replyData.message}
                          onChange={(e) => setReplyData({ ...replyData, message: e.target.value })}
                          placeholder="Yanıtınızı yazın..."
                          rows={3}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <div className="flex flex-col gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            onChange={(e) => handleFileSelect(e, true)}
                            className="hidden"
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                            title="Dosya ekle"
                          >
                            <Paperclip className="w-5 h-5 text-gray-600" />
                          </button>
                          <Button onClick={handleReply} icon={Reply} disabled={!replyData.message}>
                            Yanıtla
                          </Button>
                        </div>
                      </div>
                      {replyData.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {replyData.attachments.map((file, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg text-sm"
                            >
                              <span>{file.name}</span>
                              <button
                                onClick={() => removeAttachment(index, true)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Mail className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Görüntülemek için bir mesaj seçin</p>
                  </div>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {showComposeModal && (
        <Modal
          isOpen={showComposeModal}
          onClose={() => setShowComposeModal(false)}
          title="Yeni Mesaj"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alıcı <span className="text-red-500">*</span>
              </label>
              <select
                value={composeData.recipient_id}
                onChange={(e) => setComposeData({ ...composeData, recipient_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seçiniz...</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.full_name} ({contact.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Konu</label>
              <input
                type="text"
                value={composeData.subject}
                onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                placeholder="Mesaj konusu..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mesaj <span className="text-red-500">*</span>
              </label>
              <textarea
                value={composeData.message}
                onChange={(e) => setComposeData({ ...composeData, message: e.target.value })}
                placeholder="Mesajınızı yazın..."
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Öncelik:</label>
                <select
                  value={composeData.priority}
                  onChange={(e) => setComposeData({ ...composeData, priority: e.target.value })}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="low">Düşük</option>
                  <option value="normal">Normal</option>
                  <option value="high">Yüksek</option>
                  <option value="urgent">Acil</option>
                </select>
              </div>
              <input
                type="file"
                multiple
                onChange={(e) => handleFileSelect(e, false)}
                className="hidden"
                id="compose-file"
              />
              <label
                htmlFor="compose-file"
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <Paperclip className="w-4 h-4" />
                Dosya Ekle
              </label>
            </div>

            {composeData.attachments.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Ekler:</label>
                {composeData.attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                  >
                    <span className="text-sm">{file.name} ({formatFileSize(file.size)})</span>
                    <button
                      onClick={() => removeAttachment(index, false)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button onClick={handleSendMessage} icon={Send} className="flex-1">
                Gönder
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowComposeModal(false)}
                className="flex-1"
              >
                İptal
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
