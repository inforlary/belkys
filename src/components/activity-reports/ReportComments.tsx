import { useState, useEffect } from 'react';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../ui/Button';

interface Comment {
  id: string;
  comment_text: string;
  is_admin_comment: boolean;
  requires_revision: boolean;
  created_at: string;
  user: {
    full_name: string;
    role: string;
  };
}

interface ReportCommentsProps {
  reportId: string;
}

export default function ReportComments({ reportId }: ReportCommentsProps) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [requiresRevision, setRequiresRevision] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadComments();
  }, [reportId]);

  const loadComments = async () => {
    const { data, error } = await supabase
      .from('activity_report_comments')
      .select(`
        id,
        comment_text,
        is_admin_comment,
        requires_revision,
        created_at,
        user:profiles!user_id(full_name, role)
      `)
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setComments(data as any);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setLoading(true);
    const { error } = await supabase
      .from('activity_report_comments')
      .insert([{
        report_id: reportId,
        user_id: user?.id,
        comment_text: newComment,
        is_admin_comment: profile?.role === 'admin' || profile?.role === 'manager',
        requires_revision: requiresRevision
      }]);

    if (!error) {
      setNewComment('');
      setRequiresRevision(false);
      loadComments();
    }
    setLoading(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Yorumu silmek istediğinizden emin misiniz?')) return;

    const { error } = await supabase
      .from('activity_report_comments')
      .delete()
      .eq('id', commentId);

    if (!error) {
      loadComments();
    }
  };

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center">
        <MessageSquare className="h-5 w-5 mr-2" />
        Yorumlar ({comments.length})
      </h3>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className={`p-3 rounded-lg ${
              comment.is_admin_comment
                ? 'bg-blue-50 border border-blue-200'
                : 'bg-gray-50 border border-gray-200'
            }`}
          >
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-sm">{comment.user.full_name}</span>
                {comment.is_admin_comment && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                    Yönetici
                  </span>
                )}
                {comment.requires_revision && (
                  <span className="text-xs bg-orange-600 text-white px-2 py-0.5 rounded">
                    Revizyon Gerekli
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">
                  {new Date(comment.created_at).toLocaleDateString('tr-TR')}
                </span>
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-700">{comment.comment_text}</p>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">Henüz yorum yok</p>
        )}
      </div>

      <div className="border-t pt-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Yorumunuzu yazın..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {isAdmin && (
          <div className="mt-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={requiresRevision}
                onChange={(e) => setRequiresRevision(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Revizyon talep et</span>
            </label>
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <Button onClick={handleAddComment} disabled={loading || !newComment.trim()}>
            <Send className="h-4 w-4 mr-2" />
            Gönder
          </Button>
        </div>
      </div>
    </div>
  );
}
