-- packing_list_supplier_totals_unique only keyed on supplier_id, coalesced to one
-- placeholder UUID whenever it's null. That collapsed every "no supplier_id yet"
-- supplier (free-text names like DUPU/LOVENSE with no suppliers row) into a single
-- bucket, so saving two such suppliers on the same packing list violated the
-- constraint — even though the editor correctly treats them as separate groups
-- (it keys by supplier_id OR by the raw name). Rebuild the index to match that.
DROP INDEX IF EXISTS packing_list_supplier_totals_unique;
CREATE UNIQUE INDEX packing_list_supplier_totals_unique
  ON packing_list_supplier_totals (
    packing_list_id,
    COALESCE(supplier_id::text, 'raw:' || lower(trim(COALESCE(supplier_name, 'Sin proveedor'))))
  );
