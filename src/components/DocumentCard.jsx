import React from "react";

const DOCUMENT_TYPES = {
  catalog: { label: "Catalog", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  quotation: { label: "Quotation", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  contract: { label: "Contract", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  certificate: { label: "Certificate", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  product_sheet: { label: "Product Sheet", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
  other: { label: "Other", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" },
};

function getFileIcon(fileName) {
  const ext = fileName?.split('.').pop()?.toLowerCase();

  if (['pdf'].includes(ext)) {
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }

  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }

  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }

  if (['doc', 'docx', 'txt'].includes(ext)) {
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }

  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DocumentCard({ document, onEdit, onDelete, onPreview, viewMode = "grid" }) {
  const typeConfig = DOCUMENT_TYPES[document.document_type] || DOCUMENT_TYPES.other;

  if (viewMode === "list") {
    return (
      <div className="bg-white dark:bg-darkblack-600 rounded-xl border border-bgray-200 dark:border-darkblack-400 p-4 hover:border-primary/40 transition-all group">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="w-10 h-10 rounded-lg bg-bgray-100 dark:bg-darkblack-500 text-bgray-600 dark:text-bgray-300 flex items-center justify-center shrink-0">
            {getFileIcon(document.file_name)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm text-darkblack-700 dark:text-white truncate">
                {document.name}
              </h4>
              <span className={`text-xs px-2 py-0.5 rounded-full ${typeConfig.color} shrink-0`}>
                {typeConfig.label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-bgray-500 dark:text-bgray-400">
              <span>{document.file_name}</span>
              <span>•</span>
              <span>{formatFileSize(document.file_size)}</span>
              <span>•</span>
              <span>{formatDate(document.created_at)}</span>
              {document.quotation_number && (
                <>
                  <span>•</span>
                  <span className="text-primary font-medium">{document.quotation_number}</span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {onPreview && (
              <button
                onClick={(e) => { e.stopPropagation(); onPreview(document); }}
                className="p-1.5 hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded-lg text-bgray-600 dark:text-bgray-300 transition"
                title="Preview"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            )}
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(document); }}
                className="p-1.5 hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded-lg text-bgray-600 dark:text-bgray-300 transition"
                title="Edit"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(document); }}
                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-600 transition"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {document.notes && (
          <p className="mt-2 text-xs text-bgray-500 dark:text-bgray-400 line-clamp-2 pl-14">
            {document.notes}
          </p>
        )}
      </div>
    );
  }

  // Grid view
  return (
    <div
      onClick={() => onPreview?.(document)}
      className="bg-white dark:bg-darkblack-600 rounded-xl border border-bgray-200 dark:border-darkblack-400 p-4 hover:border-primary/40 hover:shadow-md transition-all group cursor-pointer"
    >
      {/* Type badge */}
      <div className="flex items-start justify-between mb-3">
        <span className={`text-xs px-2 py-1 rounded-lg font-medium ${typeConfig.color}`}>
          {typeConfig.label}
        </span>
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(document); }}
              className="p-1 hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded opacity-0 group-hover:opacity-100 transition text-bgray-600 dark:text-bgray-300"
              title="Edit"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(document); }}
              className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition text-red-600"
              title="Delete"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Icon */}
      <div className="w-14 h-14 rounded-xl bg-bgray-100 dark:bg-darkblack-500 text-bgray-600 dark:text-bgray-300 flex items-center justify-center mx-auto mb-3">
        {getFileIcon(document.file_name)}
      </div>

      {/* Name */}
      <h4 className="font-semibold text-sm text-darkblack-700 dark:text-white text-center mb-1 line-clamp-2 min-h-[2.5rem]">
        {document.name}
      </h4>

      {/* File info */}
      <p className="text-xs text-bgray-500 dark:text-bgray-400 text-center truncate">
        {document.file_name}
      </p>
      <p className="text-xs text-bgray-500 dark:text-bgray-400 text-center">
        {formatFileSize(document.file_size)}
      </p>

      {/* Quotation link */}
      {document.quotation_number && (
        <div className="mt-2 pt-2 border-t border-bgray-100 dark:border-darkblack-400">
          <div className="flex items-center justify-center gap-1 text-xs text-primary">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="truncate">{document.quotation_number}</span>
          </div>
        </div>
      )}

      {/* Notes */}
      {document.notes && (
        <p className="mt-2 text-xs text-bgray-500 dark:text-bgray-400 line-clamp-2">
          {document.notes}
        </p>
      )}

      {/* Date */}
      <p className="mt-2 text-xs text-bgray-400 dark:text-bgray-500 text-center">
        {formatDate(document.created_at)}
      </p>
    </div>
  );
}

export { DOCUMENT_TYPES };
