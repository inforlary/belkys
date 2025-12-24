import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { Search, X, Target, BarChart3, Briefcase, FileText, Users, Clock } from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'goal' | 'indicator' | 'activity' | 'document' | 'user';
  title: string;
  subtitle?: string;
  path: string;
  icon: any;
}

export default function GlobalSearch() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm('');
        setResults([]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      performSearch();
    } else {
      setResults([]);
    }
  }, [searchTerm]);

  const performSearch = async () => {
    if (!profile?.organization_id) return;

    setLoading(true);
    try {
      const searchPattern = `%${searchTerm}%`;

      const [goalsRes, indicatorsRes, activitiesRes, documentsRes, usersRes] = await Promise.all([
        supabase
          .from('goals')
          .select('id, title, code')
          .eq('organization_id', profile.organization_id)
          .or(`title.ilike.${searchPattern},code.ilike.${searchPattern}`)
          .limit(5),
        supabase
          .from('indicators')
          .select('id, name, code, goal:goals(title)')
          .eq('organization_id', profile.organization_id)
          .or(`name.ilike.${searchPattern},code.ilike.${searchPattern}`)
          .limit(5),
        supabase
          .from('activities')
          .select('id, title, description')
          .eq('organization_id', profile.organization_id)
          .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
          .limit(5),
        supabase
          .from('documents')
          .select('id, title, file_name')
          .eq('organization_id', profile.organization_id)
          .or(`title.ilike.${searchPattern},file_name.ilike.${searchPattern}`)
          .limit(5),
        profile.role === 'admin'
          ? supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('organization_id', profile.organization_id)
              .or(`full_name.ilike.${searchPattern},email.ilike.${searchPattern}`)
              .limit(5)
          : Promise.resolve({ data: null })
      ]);

      const searchResults: SearchResult[] = [];

      goalsRes.data?.forEach(goal => {
        searchResults.push({
          id: goal.id,
          type: 'goal',
          title: goal.title,
          subtitle: goal.code,
          path: 'goals',
          icon: Target
        });
      });

      indicatorsRes.data?.forEach(indicator => {
        searchResults.push({
          id: indicator.id,
          type: 'indicator',
          title: indicator.name,
          subtitle: `${indicator.code} - ${indicator.goal?.title || ''}`,
          path: 'indicators',
          icon: BarChart3
        });
      });

      activitiesRes.data?.forEach(activity => {
        searchResults.push({
          id: activity.id,
          type: 'activity',
          title: activity.title,
          subtitle: activity.description?.substring(0, 60),
          path: 'activities',
          icon: Briefcase
        });
      });

      documentsRes.data?.forEach(doc => {
        searchResults.push({
          id: doc.id,
          type: 'document',
          title: doc.title,
          subtitle: doc.file_name,
          path: 'document-library',
          icon: FileText
        });
      });

      usersRes.data?.forEach(user => {
        searchResults.push({
          id: user.id,
          type: 'user',
          title: user.full_name,
          subtitle: user.email,
          path: 'users',
          icon: Users
        });
      });

      setResults(searchResults);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    navigate(result.path);
    setIsOpen(false);
    setSearchTerm('');
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleResultClick(results[selectedIndex]);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'goal': return 'bg-blue-100 text-blue-700';
      case 'indicator': return 'bg-green-100 text-green-700';
      case 'activity': return 'bg-purple-100 text-purple-700';
      case 'document': return 'bg-orange-100 text-orange-700';
      case 'user': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'goal': return 'Hedef';
      case 'indicator': return 'Gösterge';
      case 'activity': return 'Faaliyet';
      case 'document': return 'Doküman';
      case 'user': return 'Kullanıcı';
      default: return type;
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span className="hidden md:inline">Ara...</span>
        <kbd className="hidden md:inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black bg-opacity-50">
          <div
            ref={searchRef}
            className="w-full max-w-2xl bg-white rounded-lg shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 p-4 border-b border-gray-200">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Hedef, gösterge, faaliyet, doküman ara..."
                className="flex-1 outline-none text-lg"
                autoFocus
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setResults([]);
                  }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}

              {!loading && searchTerm.length < 2 && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Clock className="w-12 h-12 mb-3 text-gray-400" />
                  <p className="text-sm">En az 2 karakter girin...</p>
                  <p className="text-xs mt-2 text-gray-400">
                    Hedefler, göstergeler, faaliyetler ve dokümanlar arasında arama yapın
                  </p>
                </div>
              )}

              {!loading && searchTerm.length >= 2 && results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Search className="w-12 h-12 mb-3 text-gray-400" />
                  <p className="text-sm">Sonuç bulunamadı</p>
                  <p className="text-xs mt-2 text-gray-400">
                    Farklı anahtar kelimeler deneyin
                  </p>
                </div>
              )}

              {!loading && results.length > 0 && (
                <div className="py-2">
                  {results.map((result, index) => {
                    const Icon = result.icon;
                    return (
                      <button
                        key={result.id}
                        onClick={() => handleResultClick(result)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors ${
                          index === selectedIndex ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="mt-1">
                          <Icon className="w-5 h-5 text-gray-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900 truncate">
                              {result.title}
                            </h4>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-full ${getTypeColor(
                                result.type
                              )}`}
                            >
                              {getTypeLabel(result.type)}
                            </span>
                          </div>
                          {result.subtitle && (
                            <p className="text-sm text-gray-600 truncate">{result.subtitle}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">↑</kbd>
                  <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">↓</kbd>
                  Gezin
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">Enter</kbd>
                  Seç
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">Esc</kbd>
                  Kapat
                </span>
              </div>
              <span>{results.length} sonuç</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
