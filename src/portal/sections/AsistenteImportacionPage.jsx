import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useClientPortal } from "../ClientPortalContext";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import interasiaLogo from "../../assets/images/logo/interasialogo.png";
import subpartidas from "../../data/subpartidas.json";

const fmt = (v, dec = 0) =>
  Number(v || 0).toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const N = v => parseFloat(v) || 0;

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      {children}
    </div>
  );
}

function NumInput({ value, onChange, placeholder = "0", prefix, suffix, className = "" }) {
  return (
    <div className="relative flex items-center">
      {prefix && <span className="absolute left-3 text-xs text-gray-400 pointer-events-none">{prefix}</span>}
      <input
        type="number" min="0" step="any"
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full border border-gray-200 rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${prefix ? "pl-8 pr-3" : "px-3"} ${className}`}
      />
      {suffix && <span className="absolute right-3 text-xs text-gray-400 pointer-events-none">{suffix}</span>}
    </div>
  );
}

function Section({ title, color = "bg-gray-50", children }) {
  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <div className={`px-4 py-2 ${color}`}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600">{title}</h3>
      </div>
      <div className="bg-white px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}

function ResultRow({ label, usd, cop, bold, sub }) {
  return (
    <div className={`flex items-center justify-between py-1 ${sub ? "pl-2 border-l-2 border-gray-100" : ""} ${bold ? "border-t border-gray-100 mt-0.5 pt-1.5" : ""}`}>
      <span className={`${bold ? "text-xs font-bold text-gray-900" : sub ? "text-xs text-gray-500" : "text-xs text-gray-700"} leading-tight`}>{label}</span>
      <div className="text-right ml-2 flex-shrink-0">
        {usd !== undefined && <p className={`text-xs font-mono ${bold ? "font-bold text-gray-900" : "text-gray-400"}`}>USD {fmt(usd, 2)}</p>}
        {cop !== undefined && <p className={`text-xs font-mono ${bold ? "font-bold text-blue-700" : "text-gray-700"}`}>$ {fmt(cop)}</p>}
      </div>
    </div>
  );
}

// Searchable subpartida combobox
function SubpartidaSearch({ value, gravamen, onSelect }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Sync display when value changes externally
  useEffect(() => { setQuery(value || ""); }, [value]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return subpartidas
      .filter(s => s.c.toLowerCase().includes(q) || s.d.toLowerCase().includes(q))
      .slice(0, 10);
  }, [query]);

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(item) {
    setQuery(item.c);
    setOpen(false);
    onSelect(item.c, item.g, item.d);
  }

  function handleClear() {
    setQuery("");
    onSelect("", "", "");
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex gap-1">
        <div className="relative flex-1">
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => query.length >= 2 && setOpen(true)}
            onKeyDown={e => e.key === "Escape" && setOpen(false)}
            placeholder="Buscar código o descripción…"
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-6"
          />
          {query && (
            <button onClick={handleClear}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {gravamen !== "" && gravamen !== undefined && (
          <div className="flex-shrink-0 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold text-amber-700 whitespace-nowrap">
            {gravamen}%
          </div>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {results.map(item => (
            <button key={item.c} onClick={() => handleSelect(item)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-50 last:border-0">
              <span className="font-mono text-xs text-blue-700 font-semibold">{item.c}</span>
              <span className="ml-2 text-xs text-amber-600 font-semibold">{item.g}%</span>
              <p className="text-xs text-gray-500 truncate mt-0.5">{item.d}</p>
            </button>
          ))}
        </div>
      )}
      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs text-gray-400">
          Sin resultados
        </div>
      )}
    </div>
  );
}

// PDF print-friendly sheet
function PrintSheet({ data, client_name, products }) {
  const { inputs, r } = data;
  const today = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
  const totalFOB = products.reduce((s, p) => s + N(p.qty) * N(p.unitPrice), 0);
  const iva = N(inputs.iva);

  // Per-product tax breakdown
  const productBreakdown = products
    .filter(p => p.description || N(p.unitPrice) > 0)
    .map(p => {
      const prodFOB = N(p.qty) * N(p.unitPrice);
      const prodCIF = totalFOB > 0 ? r.cifCOP * (prodFOB / totalFOB) : 0;
      const prodArancel = prodCIF * (N(p.arancel) / 100);
      const prodIVA = (prodCIF + prodArancel) * (iva / 100);
      return { ...p, prodFOB, prodCIF, prodArancel, prodIVA };
    });

  const costRows = [
    { label: "IMPUESTOS ARANCELARIOS", cop: r.arancelCOP },
    { label: "IVA (Imp + Base × 19%)", pct: inputs.iva, cop: r.ivaCOP },
    ...(r.impuestoAdicionalCOP > 0 ? [{ label: `${inputs.impuestoAdicionalNombre || "IMPUESTO ADICIONAL"} (${inputs.impuestoAdicional}%)`, cop: r.impuestoAdicionalCOP }] : []),
    { label: "GASTOS PUERTO (uso, cargue, almacenaje)", cop: inputs.gastosPuerto },
    { label: "LIBERACIÓN DE BL", cop: inputs.liberacionBL },
    { label: "GASTOS VARIOS", cop: inputs.gastosVarios },
    { label: "DECLARACIÓN DE IMPORTACIÓN", cop: inputs.declaracion },
    { label: "INGRESO AL SISTEMA", cop: inputs.ingresoSistema },
    { label: "CONSERVACIÓN DE ARCHIVO", cop: inputs.conservacion },
    { label: "SERVICIO COMERCIO EXTERIOR (0.4% mín. $800.000)", cop: r.servicioComex },
    { label: "TRANSPORTE TERRESTRE", cop: inputs.transporte },
    { label: "IVA TRANSPORTE (19%)", cop: r.ivaTransporte },
  ];

  return (
    <div className="font-sans text-sm text-gray-900 bg-white p-8 w-full" style={{ minWidth: 700 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-blue-600">
        <div>
          <h1 className="text-xl font-bold text-blue-700">PRE-LIQUIDACIÓN DE IMPORTACIÓN</h1>
          <p className="text-gray-500 text-xs mt-0.5">Estimado — sujeto a cambios según condiciones del mercado</p>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <div style={{ backgroundColor: "#0c1a3a", borderRadius: 8, padding: "6px 12px", display: "inline-block" }}>
            <img src={interasiaLogo} alt="Interasia" style={{ height: 32, objectFit: "contain", display: "block" }} />
          </div>
          <p className="text-xs font-semibold text-gray-700">{today}</p>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-3 gap-4 mb-6 bg-gray-50 rounded-lg p-3 text-xs">
        <div><span className="text-gray-500">CLIENTE:</span> <strong>{client_name}</strong></div>
        <div><span className="text-gray-500">ORIGEN:</span> <strong>{inputs.origen || "—"}</strong></div>
        <div><span className="text-gray-500">DESTINO:</span> <strong>{inputs.destino || "—"}</strong></div>
        <div><span className="text-gray-500">INCOTERM:</span> <strong>{inputs.incoterm}</strong></div>
        <div><span className="text-gray-500">TRM:</span> <strong>$ {fmt(inputs.trm)} COP/USD</strong></div>
      </div>

      {/* Products table */}
      <table className="w-full text-xs border-collapse mb-4">
        <thead>
          <tr className="bg-blue-50">
            <th className="text-left px-3 py-2 font-semibold">Producto / Descripción</th>
            <th className="text-left px-3 py-2 font-semibold w-28">Subpartida</th>
            <th className="text-right px-3 py-2 font-semibold w-16">Grav.</th>
            <th className="text-right px-3 py-2 font-semibold w-16">Cant.</th>
            <th className="text-right px-3 py-2 font-semibold w-24">P. Unit. USD</th>
            <th className="text-right px-3 py-2 font-semibold w-24">Total USD</th>
          </tr>
        </thead>
        <tbody>
          {products.filter(p => p.description || N(p.unitPrice) > 0).map((p, i) => (
            <tr key={p.id} className="border-b border-gray-100">
              <td className="px-3 py-1.5">{p.description || `Producto ${i + 1}`}</td>
              <td className="px-3 py-1.5 font-mono text-gray-500">{p.subpartida || "—"}</td>
              <td className="px-3 py-1.5 text-right font-mono">{p.arancel ? `${p.arancel}%` : "—"}</td>
              <td className="px-3 py-1.5 text-right font-mono">{fmt(N(p.qty), 0)}</td>
              <td className="px-3 py-1.5 text-right font-mono">{fmt(N(p.unitPrice), 2)}</td>
              <td className="px-3 py-1.5 text-right font-mono">{fmt(N(p.qty) * N(p.unitPrice), 2)}</td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold">
            <td className="px-3 py-2" colSpan={5}>TOTAL FOB / EXW</td>
            <td className="px-3 py-2 text-right font-mono">{fmt(totalFOB, 2)}</td>
          </tr>
        </tbody>
      </table>

      {/* CIF table */}
      <table className="w-full text-xs border-collapse mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-3 py-2 font-semibold">Concepto</th>
            <th className="text-right px-3 py-2 font-semibold">USD</th>
            <th className="text-right px-3 py-2 font-semibold">COP</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-100">
            <td className="px-3 py-1.5">Valor mercancía (FOB/EXW)</td>
            <td className="px-3 py-1.5 text-right font-mono">{fmt(totalFOB, 2)}</td>
            <td className="px-3 py-1.5 text-right font-mono">{fmt(totalFOB * inputs.trm)}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="px-3 py-1.5">+ Gastos origen</td>
            <td className="px-3 py-1.5 text-right font-mono">{fmt(inputs.gastosOrigen, 2)}</td>
            <td className="px-3 py-1.5 text-right font-mono">{fmt(inputs.gastosOrigen * inputs.trm)}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="px-3 py-1.5">+ Flete internacional</td>
            <td className="px-3 py-1.5 text-right font-mono">{fmt(inputs.flete, 2)}</td>
            <td className="px-3 py-1.5 text-right font-mono">{fmt(inputs.flete * inputs.trm)}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="px-3 py-1.5">+ Seguro</td>
            <td className="px-3 py-1.5 text-right font-mono">{fmt(inputs.seguro, 2)}</td>
            <td className="px-3 py-1.5 text-right font-mono">{fmt(inputs.seguro * inputs.trm)}</td>
          </tr>
          <tr className="bg-blue-50 font-semibold">
            <td className="px-3 py-2">= VALOR CIF / BASE GRAVABLE</td>
            <td className="px-3 py-2 text-right font-mono">{fmt(r.cifUSD, 2)}</td>
            <td className="px-3 py-2 text-right font-mono">{fmt(r.cifCOP)}</td>
          </tr>
        </tbody>
      </table>

      {/* Per-product tax breakdown */}
      {productBreakdown.length > 1 && (
        <table className="w-full text-xs border-collapse mb-4">
          <thead>
            <tr className="bg-amber-50">
              <th className="text-left px-3 py-2 font-semibold">Producto</th>
              <th className="text-right px-3 py-2 font-semibold w-20">Grav.</th>
              <th className="text-right px-3 py-2 font-semibold w-28">Arancel COP</th>
              <th className="text-right px-3 py-2 font-semibold w-20">IVA %</th>
              <th className="text-right px-3 py-2 font-semibold w-28">IVA COP</th>
              <th className="text-right px-3 py-2 font-semibold w-28">Total imp.</th>
            </tr>
          </thead>
          <tbody>
            {productBreakdown.map((p, i) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="px-3 py-1.5">{p.description || `Producto ${i + 1}`}</td>
                <td className="px-3 py-1.5 text-right font-mono">{p.arancel ? `${p.arancel}%` : "—"}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(p.prodArancel)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{iva}%</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(p.prodIVA)}</td>
                <td className="px-3 py-1.5 text-right font-mono font-semibold">{fmt(p.prodArancel + p.prodIVA)}</td>
              </tr>
            ))}
            <tr className="bg-amber-50 font-semibold">
              <td className="px-3 py-2" colSpan={2}>TOTAL TRIBUTOS (Arancel + IVA)</td>
              <td className="px-3 py-2 text-right font-mono">{fmt(r.arancelCOP)}</td>
              <td className="px-3 py-2 text-right font-mono"></td>
              <td className="px-3 py-2 text-right font-mono">{fmt(r.ivaCOP)}</td>
              <td className="px-3 py-2 text-right font-mono">{fmt(r.arancelCOP + r.ivaCOP)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Costs table */}
      <table className="w-full text-xs border-collapse mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-3 py-2 font-semibold">Concepto</th>
            <th className="text-right px-3 py-2 font-semibold w-32">Valor COP</th>
          </tr>
        </thead>
        <tbody>
          {costRows.map((row, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="px-3 py-1.5">{row.label}{row.pct !== undefined && ` (${row.pct}%)`}</td>
              <td className="px-3 py-1.5 text-right font-mono">{fmt(row.cop)}</td>
            </tr>
          ))}
          <tr className="bg-gray-900 text-white font-bold text-sm">
            <td className="px-3 py-2.5">TOTAL OPERACIÓN</td>
            <td className="px-3 py-2.5 text-right font-mono">$ {fmt(r.total)}</td>
          </tr>
        </tbody>
      </table>

      {inputs.totalUnidades > 1 && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-600 font-semibold">COSTO POR UNIDAD</p>
            <p className="text-xl font-bold text-blue-700 font-mono">$ {fmt(r.total / inputs.totalUnidades)}</p>
            <p className="text-xs text-blue-500">COP ({inputs.totalUnidades} unidades)</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 font-semibold">COSTO POR UNIDAD</p>
            <p className="text-xl font-bold text-gray-700 font-mono">USD {fmt(r.total / inputs.totalUnidades / inputs.trm, 2)}</p>
          </div>
        </div>
      )}

      <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-xs text-amber-800 space-y-1">
        <p>• Esta es una pre-liquidación aproximada ajustada a la información brindada.</p>
        <p>• Puede variar según costos y condiciones del mercado al momento del embarque.</p>
        <p>• Los impuestos se calculan con la TRM vigente al momento del pago.</p>
        <p>• La modificación en valores, detalles o mercancía modificará la oferta.</p>
      </div>
    </div>
  );
}

let nextId = 2;

export default function AsistenteImportacionPage() {
  const { session } = useClientPortal();
  const printRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  const [products, setProducts] = useState([
    { id: 1, description: "", qty: "1", unitPrice: "", subpartida: "", arancel: "10" },
  ]);

  const [inputs, setInputs] = useState({
    origen: "GUANGZHOU", destino: "", incoterm: "FOB",
    gastosOrigen: "", flete: "", seguro: "",
    fleteDestino: "",
    iva: "19",
    impuestoAdicional: "", impuestoAdicionalNombre: "",
    gastosPuerto: "6000000",
    liberacionBL: "220000", gastosVarios: "400000",
    declaracion: "60000", ingresoSistema: "60000", conservacion: "60000",
    transporte: "",
    trm: "4200",
  });

  const set = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  // Fetch live TRM on mount
  const [trmLoading, setTrmLoading] = useState(true);
  const [editingTrm, setEditingTrm] = useState(false);
  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/USD")
      .then(r => r.json())
      .then(d => { if (d.rates?.COP) set("trm", String(Math.round(d.rates.COP))); })
      .catch(() => {})
      .finally(() => setTrmLoading(false));
  }, []);

  const setProduct = useCallback((id, field, value) =>
    setProducts(ps => ps.map(p => p.id === id ? { ...p, [field]: value } : p)), []);

  const selectSubpartida = useCallback((id, codigo, gravamen) =>
    setProducts(ps => ps.map(p => p.id === id
      ? { ...p, subpartida: codigo, arancel: gravamen !== "" ? String(gravamen) : p.arancel }
      : p)), []);

  const addProduct = () => {
    setProducts(ps => [...ps, { id: nextId++, description: "", qty: "1", unitPrice: "", subpartida: "", arancel: "10" }]);
  };

  const removeProduct = id => {
    setProducts(ps => ps.length > 1 ? ps.filter(p => p.id !== id) : ps);
  };

  const r = useMemo(() => {
    const fob = products.reduce((s, p) => s + N(p.qty) * N(p.unitPrice), 0);
    const totalUnidades = products.reduce((s, p) => s + N(p.qty), 0);
    const gastosOrigen = N(inputs.gastosOrigen),
          flete = N(inputs.flete), seguro = N(inputs.seguro),
          fleteDestino = N(inputs.fleteDestino), trm = N(inputs.trm) || 4200,
          iva = N(inputs.iva),
          gastosPuerto = N(inputs.gastosPuerto),
          libBL = N(inputs.liberacionBL), gastosV = N(inputs.gastosVarios),
          decl = N(inputs.declaracion), ingreso = N(inputs.ingresoSistema),
          conserv = N(inputs.conservacion), transporte = N(inputs.transporte),
          impuAdicional = N(inputs.impuestoAdicional);

    const cifUSD = fob + gastosOrigen + flete + seguro;
    const cifCOP = cifUSD * trm;

    const arancelCOP = fob > 0
      ? products.reduce((s, p) => {
          const prodFOB = N(p.qty) * N(p.unitPrice);
          const prodCIF = cifCOP * (prodFOB / fob);
          return s + prodCIF * (N(p.arancel) / 100);
        }, 0)
      : 0;

    const ivaCOP = (cifCOP + arancelCOP) * (iva / 100);
    const impuestoAdicionalCOP = cifCOP * (impuAdicional / 100);
    const subtributos = cifCOP + arancelCOP + ivaCOP + impuestoAdicionalCOP;

    const servicioComex = Math.max(cifCOP * 0.004, 800000);
    const totalAduana = libBL + gastosV + decl + ingreso + conserv + servicioComex;
    const ivaTransporte = transporte * 0.19;
    const fleteDestCOP = fleteDestino * trm;
    const total = subtributos + gastosPuerto + totalAduana + fleteDestCOP + transporte + ivaTransporte;

    return { fob, totalUnidades, cifUSD, cifCOP, arancelCOP, ivaCOP, impuestoAdicionalCOP, subtributos, servicioComex, totalAduana, ivaTransporte, total };
  }, [inputs, products]);

  async function exportPDF() {
    if (!printRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      let yPos = 0;
      const pageH = pdf.internal.pageSize.getHeight();
      while (yPos < pdfH) {
        if (yPos > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, -yPos, pdfW, pdfH);
        yPos += pageH;
      }
      pdf.save(`preliquidacion-${session.client_name}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  const trm = N(inputs.trm) || 4200;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Asistente de Importación</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pre-liquidación estimada de tu importación desde China a Colombia</p>
        </div>
        <button onClick={exportPDF} disabled={exporting}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition shadow-sm">
          {exporting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
          {exporting ? "Generando PDF..." : "Exportar PDF"}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr,280px] gap-6">
        {/* ── INPUTS ── */}
        <div className="space-y-4">

          <Section title="Información general" color="bg-blue-50">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Origen">
                <input value={inputs.origen} onChange={e => set("origen", e.target.value)} placeholder="GUANGZHOU"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
              <Field label="Destino">
                <input value={inputs.destino} onChange={e => set("destino", e.target.value)} placeholder="BUENAVENTURA"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
            </div>
            <Field label="Incoterm">
              <select value={inputs.incoterm} onChange={e => set("incoterm", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {["FOB","EXW","CIF","CFR","DAP"].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </Section>

          {/* ── PRODUCTOS ── */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600">Productos (USD)</h3>
              <button onClick={addProduct}
                className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-800 transition">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Agregar producto
              </button>
            </div>
            <div className="bg-white">
              {products.map((p, i) => (
                <div key={p.id} className="px-3 py-2.5 border-t border-gray-50 space-y-1.5">
                  {/* Row 1: description + remove */}
                  <div className="flex gap-1">
                    <input
                      value={p.description} onChange={e => setProduct(p.id, "description", e.target.value)}
                      placeholder={`Descripción del producto ${i + 1}`}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button onClick={() => removeProduct(p.id)}
                      className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {/* Row 2: qty + price + total */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Cantidad</p>
                      <input type="number" min="1" step="1"
                        value={p.qty} onChange={e => setProduct(p.id, "qty", e.target.value)}
                        placeholder="1"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Precio unit. USD</p>
                      <input type="number" min="0" step="any"
                        value={p.unitPrice} onChange={e => setProduct(p.id, "unitPrice", e.target.value)}
                        placeholder="0.00"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Total USD</p>
                      <div className="border border-gray-100 bg-gray-50 rounded-lg px-2 py-1.5 text-sm text-right font-mono text-gray-700">
                        {fmt(N(p.qty) * N(p.unitPrice), 2)}
                      </div>
                    </div>
                  </div>
                  {/* Row 3: subpartida + arancel */}
                  <div className="grid grid-cols-[1fr,96px] gap-1.5">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Subpartida arancelaria</p>
                      <SubpartidaSearch
                        value={p.subpartida}
                        gravamen=""
                        onSelect={(codigo, gravamen) => selectSubpartida(p.id, codigo, gravamen)}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <p className="text-xs text-gray-400">Arancel</p>
                        {p.subpartida && (
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-600 leading-none">DIAN</span>
                        )}
                      </div>
                      <div className="relative">
                        <input type="number" min="0" step="any"
                          value={p.arancel}
                          onChange={e => setProduct(p.id, "arancel", e.target.value)}
                          placeholder="0"
                          className="w-full border border-gray-200 rounded-lg px-2 pr-6 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {/* FOB Total */}
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Total FOB</span>
                <span className="text-sm font-bold text-gray-900 font-mono">USD {fmt(r.fob, 2)}</span>
              </div>
              {/* Gastos adicionales */}
              <div className="px-3 py-3 border-t border-gray-100 space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Gastos adicionales (USD)</p>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Gastos origen">
                    <NumInput value={inputs.gastosOrigen} onChange={v => set("gastosOrigen", v)} prefix="$" />
                  </Field>
                  <Field label="Flete int.">
                    <NumInput value={inputs.flete} onChange={v => set("flete", v)} prefix="$" />
                  </Field>
                  <Field label="Seguro">
                    <NumInput value={inputs.seguro} onChange={v => set("seguro", v)} prefix="$" />
                  </Field>
                </div>
              </div>
            </div>
          </div>

          <Section title="Impuestos (sobre base CIF)" color="bg-amber-50">
            <Field label="IVA">
              <NumInput value={inputs.iva} onChange={v => set("iva", v)} suffix="%" />
            </Field>
            <div className="border-t border-amber-100 pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Impuesto adicional (opcional)</p>
              <div className="grid grid-cols-[1fr,80px] gap-2">
                <Field label="Nombre del impuesto">
                  <input value={inputs.impuestoAdicionalNombre} onChange={e => set("impuestoAdicionalNombre", e.target.value)}
                    placeholder="ej. IVA especial, sobretasa…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </Field>
                <Field label="Tasa %">
                  <NumInput value={inputs.impuestoAdicional} onChange={v => set("impuestoAdicional", v)} suffix="%" />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Gastos en Colombia (COP)" color="bg-green-50">
            <Field label="Gastos puerto (uso, cargue, almacenaje)">
              <NumInput value={inputs.gastosPuerto} onChange={v => set("gastosPuerto", v)} prefix="$" />
            </Field>
            <Field label="Flete destino (si aplica, USD)">
              <NumInput value={inputs.fleteDestino} onChange={v => set("fleteDestino", v)} prefix="$" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Liberación BL">
                <NumInput value={inputs.liberacionBL} onChange={v => set("liberacionBL", v)} prefix="$" />
              </Field>
              <Field label="Gastos varios">
                <NumInput value={inputs.gastosVarios} onChange={v => set("gastosVarios", v)} prefix="$" />
              </Field>
              <Field label="Declaración">
                <NumInput value={inputs.declaracion} onChange={v => set("declaracion", v)} prefix="$" />
              </Field>
              <Field label="Ingreso sistema">
                <NumInput value={inputs.ingresoSistema} onChange={v => set("ingresoSistema", v)} prefix="$" />
              </Field>
              <Field label="Conservación archivo">
                <NumInput value={inputs.conservacion} onChange={v => set("conservacion", v)} prefix="$" />
              </Field>
            </div>
            <Field label="Transporte terrestre" hint="Buenaventura / aeropuerto → destino">
              <NumInput value={inputs.transporte} onChange={v => set("transporte", v)} prefix="$" />
            </Field>
          </Section>

        </div>

        {/* ── RESULTADO ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sticky top-4">

            {/* TRM row */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-400">TRM</span>
              {editingTrm ? (
                <div className="flex items-center gap-1.5">
                  <input type="number" value={inputs.trm} onChange={e => set("trm", e.target.value)} autoFocus
                    className="w-28 border border-blue-300 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                  <span className="text-xs text-gray-400">COP</span>
                  <button onClick={() => setEditingTrm(false)}
                    className="text-xs text-blue-600 font-semibold hover:text-blue-800 px-1">✓</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {trmLoading
                    ? <span className="text-xs text-gray-400 animate-pulse">Consultando…</span>
                    : <span className="text-sm font-bold font-mono text-gray-800">$ {fmt(N(inputs.trm))} <span className="text-xs font-normal text-gray-400">COP/USD</span></span>
                  }
                  <button onClick={() => setEditingTrm(true)}
                    className="text-gray-300 hover:text-blue-500 transition" title="Editar TRM">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <h2 className="font-bold text-gray-900 mb-3 text-sm">Pre-liquidación</h2>

            <div className="divide-y divide-gray-50">
              {/* CIF */}
              <div className="pb-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">CIF / Base gravable</p>
                <ResultRow label={`Mercancía (${products.length} prod.)`} usd={r.fob} />
                <ResultRow label="+ Origen + flete + seguro" usd={N(inputs.gastosOrigen) + N(inputs.flete) + N(inputs.seguro)} sub />
                <ResultRow label="= CIF Total" usd={r.cifUSD} cop={r.cifCOP} bold />
              </div>

              {/* Impuestos */}
              <div className="py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Impuestos aduaneros</p>
                <ResultRow label="Arancel" cop={r.arancelCOP} sub />
                <ResultRow label={`IVA (${inputs.iva}%)`} cop={r.ivaCOP} sub />
                {r.impuestoAdicionalCOP > 0 && (
                  <ResultRow label={`${inputs.impuestoAdicionalNombre || "Imp. adicional"} (${inputs.impuestoAdicional}%)`} cop={r.impuestoAdicionalCOP} sub />
                )}
                <ResultRow label="Subtotal tributos" cop={r.subtributos} bold />
              </div>

              {/* Per-product breakdown */}
              {products.length > 1 && r.fob > 0 && (
                <div className="py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Desglose por producto</p>
                  {products.filter(p => N(p.qty) * N(p.unitPrice) > 0).map((p, i) => {
                    const prodFOB = N(p.qty) * N(p.unitPrice);
                    const prodCIF = r.cifCOP * (prodFOB / r.fob);
                    const prodArancel = prodCIF * (N(p.arancel) / 100);
                    const prodIVA = (prodCIF + prodArancel) * (N(inputs.iva) / 100);
                    return (
                      <div key={p.id} className="pl-2 border-l-2 border-gray-100 mb-1.5">
                        <p className="text-xs font-medium text-gray-700 truncate leading-tight">{p.description || `Prod. ${i + 1}`}</p>
                        <div className="flex gap-3 text-[10px] text-gray-500 mt-0.5 font-mono">
                          <span>Arancel: <span className="text-gray-700">$ {fmt(prodArancel)}</span></span>
                          <span>IVA: <span className="text-gray-700">$ {fmt(prodIVA)}</span></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Gastos */}
              <div className="py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Gastos en Colombia</p>
                <ResultRow label="Gastos puerto" cop={N(inputs.gastosPuerto)} sub />
                <ResultRow label="Aduana + serv. comex" cop={N(inputs.liberacionBL) + N(inputs.gastosVarios) + N(inputs.declaracion) + N(inputs.ingresoSistema) + N(inputs.conservacion) + r.servicioComex} sub />
                <ResultRow label="Transporte + IVA" cop={N(inputs.transporte) + r.ivaTransporte} sub />
              </div>

              {/* Total */}
              <div className="pt-2">
                <div className="bg-gray-900 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wide">Total operación</span>
                  <span className="text-sm font-bold text-white font-mono">$ {fmt(r.total)}</span>
                </div>
              </div>
            </div>

            {r.totalUnidades > 1 && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-blue-600 rounded-lg p-2.5 text-center text-white">
                  <p className="text-[10px] font-semibold opacity-80">Costo / unidad</p>
                  <p className="text-base font-bold font-mono mt-0.5">$ {fmt(r.total / r.totalUnidades)}</p>
                  <p className="text-[10px] opacity-70">COP · {fmt(r.totalUnidades, 0)} uds</p>
                </div>
                <div className="bg-slate-100 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] font-semibold text-gray-500">Costo / unidad</p>
                  <p className="text-base font-bold text-gray-800 font-mono mt-0.5">{fmt(r.total / r.totalUnidades / trm, 2)}</p>
                  <p className="text-[10px] text-gray-400">USD</p>
                </div>
              </div>
            )}

            <p className="text-[10px] text-gray-300 text-center mt-3">
              Estimado · sujeto a cambios de mercado
            </p>
          </div>
        </div>
      </div>

      {/* ── Hidden print sheet ── */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none">
        <div ref={printRef}>
          <PrintSheet
            products={products}
            data={{
              inputs: {
                ...inputs,
                gastosOrigen: N(inputs.gastosOrigen), flete: N(inputs.flete),
                seguro: N(inputs.seguro), fleteDestino: N(inputs.fleteDestino),
                trm: N(inputs.trm) || 4200,
                iva: N(inputs.iva), impuestoAdicional: N(inputs.impuestoAdicional),
                impuestoAdicionalNombre: inputs.impuestoAdicionalNombre,
                gastosPuerto: N(inputs.gastosPuerto), liberacionBL: N(inputs.liberacionBL),
                gastosVarios: N(inputs.gastosVarios), declaracion: N(inputs.declaracion),
                ingresoSistema: N(inputs.ingresoSistema), conservacion: N(inputs.conservacion),
                transporte: N(inputs.transporte), totalUnidades: r.totalUnidades,
              },
              r,
            }}
            client_name={session.client_name}
          />
        </div>
      </div>
    </div>
  );
}
