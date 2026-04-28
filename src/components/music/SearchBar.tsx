import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: (e?: React.FormEvent) => void;
  onClear: () => void;
}

export default function SearchBar({ query, onQueryChange, onSearch, onClear }: SearchBarProps) {
  return (
    <div className="shrink-0 p-4 border-b border-zinc-800/50 bg-zinc-900/30">
      <form onSubmit={onSearch} className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="搜索歌曲或专辑..."
          className="input-dark w-full pl-9 pr-8"
        />
        {query.trim() && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </form>
    </div>
  );
}
