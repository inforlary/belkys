import { useState, useEffect, useMemo } from 'react';
import { Search, ChevronRight, Star, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ABSCode {
  id: string;
  code: string;
  name: string;
  full_code: string;
  level: number;
  parent_id?: string;
}

interface ABSCodeSelectorProps {
  codeType: 'institutional' | 'expense_economic' | 'revenue_economic' | 'financing';
  organizationId: string;
  value: string;
  onChange: (codeId: string, code: ABSCode | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function ABSCodeSelector({
  codeType,
  organizationId,
  value,
  onChange,
  label,
  required = false,
  disabled = false
}: ABSCodeSelectorProps) {
  const [codes, setCodes] = useState<ABSCode[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [recentCodes, setRecentCodes] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const cacheKey = `abs_codes_${codeType}_${organizationId}`;
  const recentKey = `recent_codes_${codeType}`;
  const favKey = `favorite_codes_${codeType}`;

  useEffect(() => {
    loadCodes();
    loadRecentAndFavorites();
  }, [organizationId, codeType]);

  const loadCodes = async () => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data: cachedData, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        if (age < 3600000) {
          setCodes(cachedData);
          setLoading(false);
          return;
        }
      }

      const tableName = getTableName(codeType);
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('full_code');

      if (error) throw error;

      if (data) {
        setCodes(data);
        localStorage.setItem(cacheKey, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('Error loading codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentAndFavorites = () => {
    const recent = localStorage.getItem(recentKey);
    const favs = localStorage.getItem(favKey);
    if (recent) setRecentCodes(JSON.parse(recent));
    if (favs) setFavorites(JSON.parse(favs));
  };

  const getTableName = (type: string) => {
    const map: Record<string, string> = {
      institutional: 'institutional_codes',
      expense_economic: 'expense_economic_codes',
      revenue_economic: 'revenue_economic_codes',
      financing: 'financing_types'
    };
    return map[type] || 'institutional_codes';
  };

  const filteredCodes = useMemo(() => {
    if (!searchTerm) return codes;

    const term = searchTerm.toLowerCase();
    return codes.filter(code =>
      code.code.toLowerCase().includes(term) ||
      code.name.toLowerCase().includes(term) ||
      code.full_code?.toLowerCase().includes(term)
    );
  }, [codes, searchTerm]);

  const handleSelect = (code: ABSCode) => {
    onChange(code.id, code);

    const recent = [code.id, ...recentCodes.filter(id => id !== code.id)].slice(0, 10);
    setRecentCodes(recent);
    localStorage.setItem(recentKey, JSON.stringify(recent));
  };

  const toggleFavorite = (codeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavorites = favorites.includes(codeId)
      ? favorites.filter(id => id !== codeId)
      : [...favorites, codeId];
    setFavorites(newFavorites);
    localStorage.setItem(favKey, JSON.stringify(newFavorites));
  };

  const selectedCode = codes.find(c => c.id === value);

  const recentCodesList = recentCodes.map(id => codes.find(c => c.id === id)).filter(Boolean) as ABSCode[];
  const favoriteCodesList = favorites.map(id => codes.find(c => c.id === id)).filter(Boolean) as ABSCode[];

  if (loading) {
    return (
      <div>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
          Yükleniyor...
        </div>
      </div>
    );
  }

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        <select
          required={required}
          disabled={disabled}
          value={value}
          onChange={(e) => {
            const code = codes.find(c => c.id === e.target.value);
            handleSelect(code!);
          }}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none"
        >
          <option value="">Seçiniz...</option>

          {favoriteCodesList.length > 0 && (
            <optgroup label="⭐ Favoriler">
              {favoriteCodesList.map((code) => (
                <option key={code.id} value={code.id}>
                  {code.full_code || code.code} - {code.name}
                </option>
              ))}
            </optgroup>
          )}

          {recentCodesList.length > 0 && (
            <optgroup label="🕐 Son Kullanılanlar">
              {recentCodesList.map((code) => (
                <option key={code.id} value={code.id}>
                  {code.full_code || code.code} - {code.name}
                </option>
              ))}
            </optgroup>
          )}

          <optgroup label="Tüm Kodlar">
            {filteredCodes.map((code) => (
              <option key={code.id} value={code.id}>
                {code.full_code || code.code} - {code.name}
              </option>
            ))}
          </optgroup>
        </select>

        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <ChevronRight className="w-5 h-5 text-gray-400 transform rotate-90" />
        </div>
      </div>

      <div className="mt-2 relative">
        <input
          type="text"
          placeholder="Kod veya isim ile ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 pl-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      </div>

      {selectedCode && (
        <div className="mt-2 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
          <div className="text-sm">
            <div className="font-semibold text-blue-900">
              {selectedCode.full_code || selectedCode.code}
            </div>
            <div className="text-blue-700">{selectedCode.name}</div>
          </div>
          <button
            type="button"
            onClick={(e) => toggleFavorite(selectedCode.id, e)}
            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <Star
              className={`w-5 h-5 ${
                favorites.includes(selectedCode.id)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-400'
              }`}
            />
          </button>
        </div>
      )}
    </div>
  );
}
