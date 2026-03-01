import React, { useState } from "react";
import { useTranslation } from "react-i18next";

export default function HierarchySelector({
  viewMode,
  hierarchy,
  selectedId,
  onSelect,
  onClose
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  // Filter hierarchy based on search
  const filteredItems = hierarchy.filter(item => {
    const searchLower = searchQuery.toLowerCase();

    if (viewMode === 'client') {
      // Filter clients with projects
      const hasProjects = item.projects && item.projects.length > 0;
      if (!hasProjects) return false;

      return item.company_name?.toLowerCase().includes(searchLower) ||
             item.contact_person?.toLowerCase().includes(searchLower);
    } else {
      // Filter suppliers with products
      const hasProducts = item.products && item.products.length > 0;
      if (!hasProducts) return false;

      return item.name?.toLowerCase().includes(searchLower) ||
             item.sales_person?.toLowerCase().includes(searchLower);
    }
  });

  const getItemName = (item) => {
    return viewMode === 'client' ? item.company_name : item.name;
  };

  const getItemCount = (item) => {
    if (viewMode === 'client') {
      return item.projects?.length || 0;
    } else {
      return item.products?.length || 0;
    }
  };

  const getItemIcon = (item) => {
    return viewMode === 'client' ? '🏢' : '🏭';
  };

  return (
    <div className="w-80 h-full bg-white dark:bg-darkblack-600 border-r border-bgray-200 dark:border-darkblack-400 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-bgray-200 dark:border-darkblack-400">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-darkblack-700 dark:text-white">
            {viewMode === 'client' ? 'Clients' : 'Suppliers'}
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-bgray-500 hover:text-bgray-700 dark:hover:text-bgray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder={`Search ${viewMode === 'client' ? 'clients' : 'suppliers'}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-darkblack-500 text-darkblack-700 dark:text-white"
        />

        {/* Count */}
        <div className="mt-2 text-xs text-bgray-500 dark:text-bgray-400">
          {filteredItems.length} {viewMode === 'client' ? 'clients' : 'suppliers'} with {viewMode === 'client' ? 'projects' : 'products'}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-bgray-500 dark:text-bgray-400">
            <div className="text-4xl mb-2">📭</div>
            <div className="text-sm">
              {searchQuery ? 'No matches found' : `No ${viewMode === 'client' ? 'clients with projects' : 'suppliers with products'}`}
            </div>
          </div>
        ) : (
          <div className="p-2">
            {filteredItems.map((item) => {
              const itemId = item.id;
              const isSelected = selectedId === itemId;
              const count = getItemCount(item);

              return (
                <button
                  key={itemId}
                  onClick={() => onSelect(itemId)}
                  className={`w-full p-3 mb-2 rounded-lg text-left transition-all ${
                    isSelected
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-bgray-100 dark:bg-darkblack-500 hover:bg-bgray-200 dark:hover:bg-darkblack-400 text-darkblack-700 dark:text-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">{getItemIcon(item)}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold text-sm truncate ${isSelected ? 'text-white' : ''}`}>
                        {getItemName(item)}
                      </div>
                      <div className={`text-xs mt-1 ${isSelected ? 'text-white/80' : 'text-bgray-500 dark:text-bgray-400'}`}>
                        {count} {viewMode === 'client' ? 'project' : 'product'}{count !== 1 ? 's' : ''}
                      </div>
                      {viewMode === 'client' && item.contact_person && (
                        <div className={`text-xs mt-0.5 ${isSelected ? 'text-white/70' : 'text-bgray-400'}`}>
                          👤 {item.contact_person}
                        </div>
                      )}
                      {viewMode === 'supplier' && item.sales_person && (
                        <div className={`text-xs mt-0.5 ${isSelected ? 'text-white/70' : 'text-bgray-400'}`}>
                          👤 {item.sales_person}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <svg className="w-5 h-5 text-white flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-bgray-200 dark:border-darkblack-400 bg-bgray-50 dark:bg-darkblack-500">
        <div className="text-xs text-bgray-600 dark:text-bgray-400">
          💡 Click a {viewMode === 'client' ? 'client' : 'supplier'} to view their complete hierarchy
        </div>
      </div>
    </div>
  );
}
