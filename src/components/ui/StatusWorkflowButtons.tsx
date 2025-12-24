import { useState } from 'react';
import { VoucherStatus, getNextStatusOptions, canTransitionStatus, changeStatus, getStatusLabel } from '../../utils/statusWorkflow';
import Button from './Button';
import Modal from './Modal';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface StatusWorkflowButtonsProps {
  currentStatus: VoucherStatus;
  entityType: string;
  entityId: string;
  userRole: string;
  organizationId: string;
  onStatusChange: () => void;
}

export default function StatusWorkflowButtons({
  currentStatus,
  entityType,
  entityId,
  userRole,
  organizationId,
  onStatusChange
}: StatusWorkflowButtonsProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<VoucherStatus | null>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const nextOptions = getNextStatusOptions(currentStatus, userRole);

  if (nextOptions.length === 0) {
    return null;
  }

  const handleStatusChange = async () => {
    if (!selectedStatus) return;

    setLoading(true);
    const result = await changeStatus(
      entityType,
      entityId,
      selectedStatus,
      '',
      organizationId,
      comment
    );

    setLoading(false);

    if (result.success) {
      setShowModal(false);
      setComment('');
      onStatusChange();
    } else {
      alert(result.error || 'Durum değiştirme işlemi başarısız');
    }
  };

  const openModal = (status: VoucherStatus) => {
    setSelectedStatus(status);
    setShowModal(true);
  };

  const getButtonVariant = (status: VoucherStatus): 'primary' | 'outline' | 'ghost' => {
    if (status === 'approved' || status === 'posted') return 'primary';
    if (status === 'cancelled') return 'outline';
    return 'ghost';
  };

  const getButtonIcon = (status: VoucherStatus) => {
    if (status === 'approved' || status === 'posted') return <CheckCircle className="w-4 h-4 mr-2" />;
    if (status === 'cancelled') return <XCircle className="w-4 h-4 mr-2" />;
    return <AlertCircle className="w-4 h-4 mr-2" />;
  };

  return (
    <>
      <div className="flex gap-2">
        {nextOptions.map((status) => (
          <Button
            key={status}
            variant={getButtonVariant(status)}
            size="sm"
            onClick={() => openModal(status)}
          >
            {getButtonIcon(status)}
            {getStatusLabel(status)}
          </Button>
        ))}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setComment('');
        }}
        title={`Durum Değiştir: ${selectedStatus ? getStatusLabel(selectedStatus) : ''}`}
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Kaydın durumu <strong>{getStatusLabel(currentStatus)}</strong> iken{' '}
            <strong>{selectedStatus ? getStatusLabel(selectedStatus) : ''}</strong> olarak değiştirilecek.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Açıklama (İsteğe Bağlı)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="İşleme dair açıklama girebilirsiniz..."
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowModal(false);
                setComment('');
              }}
              disabled={loading}
            >
              İptal
            </Button>
            <Button onClick={handleStatusChange} disabled={loading}>
              {loading ? 'İşleniyor...' : 'Onayla'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
