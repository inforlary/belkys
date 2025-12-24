import { useState } from 'react';
import { X, Plus, Filter } from 'lucide-react';
import Button from './Button';
import Modal from './Modal';

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'number' | 'daterange';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface FilterValue {
  field: string;
  operator: string;
  value: any;
}

interface AdvancedFilterProps {
  fields: FilterField[];
  onApply: (filters: FilterValue[]) => void;
  onClear: () => void;
  defaultFilters?: FilterValue[];
}

const operators = {
  text: [
    { value: 'contains', label: 'İçerir' },
    { value: 'equals', label: 'Eşittir' },
    { value: 'startsWith', label: 'Başlar' },
    { value: 'endsWith', label: 'Biter' }
  ],
  number: [
    { value: 'equals', label: 'Eşittir' },
    { value: 'gt', label: 'Büyüktür' },
    { value: 'gte', label: 'Büyük Eşit' },
    { value: 'lt', label: 'Küçüktür' },
    { value: 'lte', label: 'Küçük Eşit' }
  ],
  select: [
    { value: 'equals', label: 'Eşittir' },
    { value: 'notEquals', label: 'Eşit Değil' }
  ],
  date: [
    { value: 'equals', label: 'Eşittir' },
    { value: 'before', label: 'Önce' },
    { value: 'after', label: 'Sonra' }
  ],
  daterange: [
    { value: 'between', label: 'Arasında' }
  ]
};

export default function AdvancedFilter({
  fields,
  onApply,
  onClear,
  defaultFilters = []
}: AdvancedFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterValue[]>(
    defaultFilters.length > 0 ? defaultFilters : [{ field: '', operator: '', value: '' }]
  );

  const addFilter = () => {
    setFilters([...filters, { field: '', operator: '', value: '' }]);
  };

  const removeFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    setFilters(newFilters.length > 0 ? newFilters : [{ field: '', operator: '', value: '' }]);
  };

  const updateFilter = (index: number, updates: Partial<FilterValue>) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...updates };

    if (updates.field) {
      const field = fields.find(f => f.key === updates.field);
      if (field) {
        const availableOps = operators[field.type];
        newFilters[index].operator = availableOps[0].value;
        newFilters[index].value = '';
      }
    }

    setFilters(newFilters);
  };

  const handleApply = () => {
    const validFilters = filters.filter(f => f.field && f.operator && f.value);
    onApply(validFilters);
    setIsOpen(false);
  };

  const handleClear = () => {
    setFilters([{ field: '', operator: '', value: '' }]);
    onClear();
    setIsOpen(false);
  };

  const getOperators = (fieldKey: string) => {
    const field = fields.find(f => f.key === fieldKey);
    return field ? operators[field.type] : [];
  };

  const renderValueInput = (filter: FilterValue, index: number) => {
    const field = fields.find(f => f.key === filter.field);
    if (!field) return null;

    const commonClasses = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent";

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={filter.value}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
            placeholder={field.placeholder || 'Değer girin...'}
            className={commonClasses}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={filter.value}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
            placeholder={field.placeholder || 'Sayı girin...'}
            className={commonClasses}
          />
        );

      case 'select':
        return (
          <select
            value={filter.value}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
            className={commonClasses}
          >
            <option value="">Seçin...</option>
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'date':
        return (
          <input
            type="date"
            value={filter.value}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
            className={commonClasses}
          />
        );

      case 'daterange':
        return (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={filter.value?.start || ''}
              onChange={(e) => updateFilter(index, {
                value: { ...filter.value, start: e.target.value }
              })}
              placeholder="Başlangıç"
              className={commonClasses}
            />
            <input
              type="date"
              value={filter.value?.end || ''}
              onChange={(e) => updateFilter(index, {
                value: { ...filter.value, end: e.target.value }
              })}
              placeholder="Bitiş"
              className={commonClasses}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const activeFilterCount = filters.filter(f => f.field && f.operator && f.value).length;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        icon={Filter}
      >
        Gelişmiş Filtre
        {activeFilterCount > 0 && (
          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
            {activeFilterCount}
          </span>
        )}
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Gelişmiş Filtreleme"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Birden fazla filtre oluşturabilir ve verileri detaylı şekilde süzebilirsiniz.
          </p>

          <div className="space-y-3">
            {filters.map((filter, index) => (
              <div
                key={index}
                className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Filtre {index + 1}
                  </span>
                  {filters.length > 1 && (
                    <button
                      onClick={() => removeFilter(index)}
                      className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Alan
                    </label>
                    <select
                      value={filter.field}
                      onChange={(e) => updateFilter(index, { field: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Seçin...</option>
                      {fields.map(field => (
                        <option key={field.key} value={field.key}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Operatör
                    </label>
                    <select
                      value={filter.operator}
                      onChange={(e) => updateFilter(index, { operator: e.target.value })}
                      disabled={!filter.field}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    >
                      <option value="">Seçin...</option>
                      {getOperators(filter.field).map(op => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Değer
                    </label>
                    {renderValueInput(filter, index)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addFilter}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Filtre Ekle
          </button>

          <div className="flex gap-3 pt-4 border-t">
            <Button onClick={handleApply} className="flex-1">
              Filtreleri Uygula
            </Button>
            <Button variant="outline" onClick={handleClear} className="flex-1">
              Temizle
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
