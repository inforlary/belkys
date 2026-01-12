import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function StarRating({ value, onChange, readonly = false, size = 'md' }: StarRatingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const handleClick = (rating: number) => {
    if (!readonly && onChange) {
      onChange(rating);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => handleClick(rating)}
          disabled={readonly}
          className={`transition-all ${
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
          }`}
        >
          <Star
            className={`${sizeClasses[size]} ${
              rating <= value
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-none text-gray-300'
            }`}
          />
        </button>
      ))}
      <span className="ml-2 text-sm font-medium text-gray-700">{value}</span>
    </div>
  );
}

const labels = [
  '',
  'Çok Yetersiz',
  'Yetersiz',
  'Kısmen Yeterli',
  'Yeterli',
  'Çok İyi'
];

interface StarRatingWithLabelProps extends StarRatingProps {
  showLabel?: boolean;
}

export function StarRatingWithLabel({ value, onChange, readonly = false, size = 'md', showLabel = true }: StarRatingWithLabelProps) {
  return (
    <div className="space-y-2">
      <StarRating value={value} onChange={onChange} readonly={readonly} size={size} />
      {showLabel && (
        <p className="text-sm text-gray-600">
          {labels[value] || ''}
        </p>
      )}
    </div>
  );
}
