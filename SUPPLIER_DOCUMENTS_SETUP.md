# Supplier Documents System - Setup Guide

## Overview
A complete document management system for suppliers with support for catalogs, quotations, contracts, certificates, and more.

## Features Implemented

### ✅ Document Management
- Upload documents with drag & drop
- Support for PDFs, images, Office docs, spreadsheets
- Document types: Catalog, Quotation, Contract, Certificate, Product Sheet, Other
- Link documents to quotations
- Rich metadata (name, notes, dates, reference numbers)

### ✅ Quotation-Specific Fields
- Reference number
- Amount/value
- Validity date
- Status (pending, approved, rejected, expired)

### ✅ Views & Filters
- Grid and list view toggle
- Filter by document type
- Filter by quotation
- Search by name, filename, notes, quotation number

### ✅ File Preview
- Image preview (JPG, PNG, GIF, SVG, WebP)
- PDF preview (embedded viewer)
- Download option for all files

### ✅ UI Components
- Tabbed drawer in SuppliersPage (Details + Documents)
- Professional card and list layouts
- File type icons and color-coded badges
- Responsive design

## Setup Instructions

### 1. Run Database Migration

Go to your Supabase Dashboard → SQL Editor and run the migration file:

```bash
supabase-migration-supplier-documents.sql
```

This will create:
- `supplier_documents` table with all fields
- Indexes for performance
- Row Level Security (RLS) policies
- Auto-update triggers

### 2. Create Storage Bucket

**In Supabase Dashboard:**

1. Go to **Storage** section
2. Click **New bucket**
3. Bucket name: `supplier-documents`
4. Set as **Public** (or configure policies)
5. Recommended file size limit: **50MB**

**Storage Policies (if using private bucket):**

```sql
-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'supplier-documents');

-- Allow authenticated users to view
CREATE POLICY "Allow authenticated reads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'supplier-documents');

-- Allow authenticated users to delete own files
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'supplier-documents');
```

### 3. Test the System

1. Go to **Suppliers** page
2. Click on any existing supplier
3. Switch to **Documents** tab
4. Upload a test document
5. Verify file appears in Supabase Storage

## File Structure

### Components Created
```
src/
├── components/
│   ├── FileUpload.jsx           # Drag & drop file uploader
│   ├── DocumentCard.jsx          # Document card display (grid/list)
│   └── SupplierDocumentsTab.jsx  # Main documents management
└── pages/
    └── SuppliersPage.jsx         # Updated with Documents tab
```

### Database Schema

**Table: `supplier_documents`**
```sql
- id (UUID, primary key)
- supplier_id (UUID, references suppliers)
- quotation_id (UUID, optional, references quotations)
- name (text, required)
- document_type (text, required)
- file_url (text, required)
- file_name (text, required)
- file_size (integer)
- notes (text)
- validity_date (date)
- amount (decimal)
- reference_number (text)
- status (text)
- created_at (timestamp)
- updated_at (timestamp)
```

## Usage

### Upload a Document
1. Open supplier drawer
2. Go to Documents tab
3. Click "Upload Document"
4. Drag & drop or browse for file
5. Fill in metadata (name, type, etc.)
6. Optionally link to quotation
7. Click "Upload"

### Link to Quotation
- When uploading/editing a document
- Select a quotation from the dropdown
- The quotation number will appear on the document card

### Filter & Search
- **Search bar**: Search by name, filename, notes, quotation number
- **Type filter**: Filter by document type
- **Quotation filter**: Show only documents linked to specific quotation
- **View toggle**: Switch between grid and list view

### Preview Documents
- Click any document card to preview
- Images and PDFs show inline preview
- Other file types show download button

## Document Types

| Type | Use Case | Color |
|------|----------|-------|
| **Catalog** | Product catalogs, price lists | Blue |
| **Quotation** | Supplier quotations, price quotes | Green |
| **Contract** | Agreements, contracts | Purple |
| **Certificate** | Quality certs, compliance docs | Yellow |
| **Product Sheet** | Spec sheets, datasheets | Indigo |
| **Other** | Miscellaneous documents | Gray |

## Quotation-Specific Features

When document type is "Quotation", additional fields appear:
- **Reference Number**: e.g., "QT-2024-001"
- **Amount**: Quote value
- **Validity Date**: Quote expiration
- **Status**: Pending, Approved, Rejected, Expired

## Troubleshooting

### Files not uploading
- Check storage bucket exists and is named `supplier-documents`
- Verify bucket permissions (public or RLS policies)
- Check file size (max 50MB recommended)

### Documents not loading
- Verify migration ran successfully
- Check browser console for errors
- Ensure RLS policies allow access

### Preview not working
- PDFs require browser PDF support
- Some file types don't support preview (shows download button)
- Check file_url is accessible

## Future Enhancements

Possible additions:
- Version control for updated documents
- Document templates
- Bulk upload
- Tags/categories
- Document expiration alerts
- Integration with quotations page
- Document sharing via email
- OCR for searchable PDFs

---

**Last Updated**: 2026-02-24
