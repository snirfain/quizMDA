/**
 * Search Bar Component
 * Global search with autocomplete
 * Hebrew: חיפוש
 */

import React, { useState, useEffect, useRef } from 'react';
import { registerShortcut } from '../utils/keyboardNavigation';
import { announce } from '../utils/accessibility';

export default function SearchBar({ onSearch, placeholder = 'חיפוש...', autoFocus = false }) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    // Register / shortcut to focus search
    const cleanup = registerShortcut('/', () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, { preventDefault: true });

    return cleanup;
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    
    // Trigger search
    if (onSearch) {
      onSearch(value);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch && query.trim()) {
      onSearch(query.trim());
      announce(`מחפש: ${query}`);
    }
  };

  const handleClear = () => {
    setQuery('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
    if (onSearch) {
      onSearch('');
    }
    announce('חיפוש נוקה');
  };

  return (
    <form
      style={styles.container}
      onSubmit={handleSubmit}
      role="search"
      aria-label="חיפוש"
    >
      <div style={styles.searchWrapper}>
        <label htmlFor="search-input" className="sr-only">
          {placeholder}
        </label>
        <input
          ref={inputRef}
          id="search-input"
          type="search"
          value={query}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          style={styles.input}
          aria-label={placeholder}
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
        />
        <div style={styles.icons}>
          {query && (
            <button
              type="button"
              onClick={handleClear}
              style={styles.clearButton}
              aria-label="נקה חיפוש"
            >
              ✕
            </button>
          )}
          <button
            type="submit"
            style={styles.searchButton}
            aria-label="חפש"
          >
            🔍
          </button>
        </div>
      </div>
      
      {suggestions.length > 0 && isFocused && (
        <div
          style={styles.suggestions}
          role="listbox"
          aria-label="הצעות חיפוש"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              style={styles.suggestionItem}
              role="option"
              onClick={() => {
                setQuery(suggestion);
                if (onSearch) onSearch(suggestion);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setQuery(suggestion);
                  if (onSearch) onSearch(suggestion);
                }
              }}
              tabIndex={0}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </form>
  );
}

const styles = {
  container: {
    position: 'relative',
    width: '100%',
    maxWidth: '500px',
    direction: 'rtl'
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  input: {
    width: '100%',
    padding: '10px 40px 10px 12px',
    fontSize: '14px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    direction: 'rtl',
    textAlign: 'right',
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px',
      borderColor: '#CC0000'
    }
  },
  icons: {
    position: 'absolute',
    left: '8px',
    display: 'flex',
    gap: '4px',
    alignItems: 'center'
  },
  clearButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#757575',
    cursor: 'pointer',
    padding: '4px',
    fontSize: '14px',
    '&:hover': {
      color: '#212121'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px',
      borderRadius: '2px'
    }
  },
  searchButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#757575',
    cursor: 'pointer',
    padding: '4px',
    fontSize: '18px',
    '&:hover': {
      color: '#CC0000'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px',
      borderRadius: '2px'
    }
  },
  suggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    maxHeight: '200px',
    overflowY: 'auto',
    zIndex: 1000
  },
  suggestionItem: {
    padding: '10px 12px',
    cursor: 'pointer',
    fontSize: '14px',
    borderBottom: '1px solid #f5f5f5',
    '&:hover': {
      backgroundColor: '#f5f5f5'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '-2px',
      backgroundColor: '#f0f7ff'
    },
    '&:last-child': {
      borderBottom: 'none'
    }
  }
};
