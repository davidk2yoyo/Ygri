import React, { useState, useMemo, useRef } from "react";
import { useClientPortal } from "../ClientPortalContext";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const fmt = (v, dec = 0) =>
  Number(v || 0).toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: dec });

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
    <div className={`rounded-xl border border-gray-100 overflow-hidden`}>
      <div className={`px-4 py-2 ${color}`}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600">{title}</h3>
      </div>
      <div className="bg-white px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}

function ResultRow({ label, usd, cop, bold, sub }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${sub ? "pl-3 border-l-2 border-gray-100" : ""} ${bold ? "border-t border-gray-100 mt-1 pt-2" : ""}`}>
      <span className={`text-sm ${bold ? "font-bold text-gray-900" : sub ? "text-xs text-gray-500" : "text-gray-700"}`}>{label}</span>
      <div className="text-right">
        {usd !== undefined && <p className={`text-xs font-mono ${bold ? "font-bold text-gray-900" : "text-gray-500"}`}>USD {fmt(usd, 2)}</p>}
        {cop !== undefined && <p className={`text-sm font-mono ${bold ? "font-bold text-blue-700" : "text-gray-700"}`}>$ {fmt(cop)} COP</p>}
      </div>
    </div>
  );
}

// PDF print-friendly sheet
function PrintSheet({ data, client_name }) {
  const { inputs, r } = data;
  const today = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });

  const rows = [
    { label: "VALOR MERCANCÍA (FOB)", usd: inputs.fob, cop: inputs.fob * inputs.trm },
    { label: "GASTOS ORIGEN", usd: inputs.gastosOrigen, cop: inputs.gastosOrigen * inputs.trm },
    { label: "FLETE Y GASTOS EN DESTINO", usd: inputs.flete + inputs.fleteDestino, cop: (inputs.flete + inputs.fleteDestino) * inputs.trm },
    { label: "IMPUESTOS ARANCELARIOS", pct: inputs.arancel, cop: r.arancelCOP },
    { label: "IVA (Imp + Base × 19%)", pct: inputs.iva, cop: r.ivaCOP },
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
      <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-blue-600">
        <div>
          <h1 className="text-xl font-bold text-blue-700">PRE-LIQUIDACIÓN DE IMPORTACIÓN</h1>
          <p className="text-gray-500 text-xs mt-0.5">Estimado — sujeto a cambios según condiciones del mercado</p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p className="font-semibold text-gray-800">{today}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6 bg-gray-50 rounded-lg p-3 text-xs">
        <div><span className="text-gray-500">CLIENTE:</span> <strong>{client_name}</strong></div>
        <div><span className="text-gray-500">ORIGEN:</span> <strong>{inputs.origen || "—"}</strong></div>
        <div><span className="text-gray-500">DESTINO:</span> <strong>{inputs.destino || "—"}</strong></div>
        <div><span className="text-gray-500">INCOTERM:</span> <strong>{inputs.incoterm}</strong></div>
        <div><span className="text-gray-500">TRM:</span> <strong>$ {fmt(inputs.trm)} COP/USD</strong></div>
        <div><span className="text-gray-500">SUBPARTIDA:</span> <strong>{inputs.subpartida || "—"}</strong></div>
      </div>

      {/* CIF table */}
      <table className="w-full text-xs border-collapse mb-4">
        <thead>
          <tr className="bg-blue-50">
            <th className="text-left px-3 py-2 font-semibold">Concepto</th>
            <th className="text-right px-3 py-2 font-semibold">USD</th>
            <th className="text-right px-3 py-2 font-semibold">COP</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-100">
            <td className="px-3 py-1.5">Valor mercancía (FOB/EXW)</td>
            <td className="px-3 py-1.5 text-right font-mono">{fmt(inputs.fob, 2)}</td>
            <td className="px-3 py-1.5 text-right font-mono">{fmt(inputs.fob * inputs.trm)}</td>
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

      {/* Costs table */}
      <table className="w-full text-xs border-collapse mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-3 py-2 font-semibold">Concepto</th>
            <th className="text-right px-3 py-2 font-semibold w-32">Valor COP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="px-3 py-1.5">
                {row.label}
                {row.pct !== undefined && ` (${row.pct}%)`}
              </td>
              <td className="px-3 py-1.5 text-right font-mono">{fmt(row.cop)}</td>
            </tr>
          ))}
          <tr className="bg-gray-900 text-white font-bold text-sm">
            <td className="px-3 py-2.5">TOTAL OPERACIÓN</td>
            <td className="px-3 py-2.5 text-right font-mono">$ {fmt(r.total)}</td>
          </tr>
        </tbody>
      </table>

      {inputs.unidades > 1 && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-600 font-semibold">COSTO POR UNIDAD</p>
            <p className="text-xl font-bold text-blue-700 font-mono">$ {fmt(r.total / inputs.unidades)}</p>
            <p className="text-xs text-blue-500">COP ({inputs.unidades} unidades)</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 font-semibold">COSTO POR UNIDAD</p>
            <p className="text-xl font-bold text-gray-700 font-mono">USD {fmt(r.total / inputs.unidades / inputs.trm, 2)}</p>
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

const N = v => parseFloat(v) || 0;

export default function AsistenteImportacionPage() {
  const { session } = useClientPortal();
  const printRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  const [inputs, setInputs] = useState({
    origen: "GUANGZHOU",  destino: "",   incoterm: "FOB",
    subpartida: "",
    fob: "",              gastosOrigen: "",  flete: "",    seguro: "",
    fleteDestino: "",
    arancel: "10",        iva: "19",
    gastosPuerto: "6000000",
    liberacionBL: "220000", gastosVarios: "400000",
    declaracion: "60000", ingresoSistema: "60000", conservacion: "60000",
    transporte: "",
    trm: "4200",          unidades: "1",
  });

  const set = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  const r = useMemo(() => {
    const fob = N(inputs.fob), gastosOrigen = N(inputs.gastosOrigen),
          flete = N(inputs.flete), seguro = N(inputs.seguro),
          fleteDestino = N(inputs.fleteDestino), trm = N(inputs.trm) || 4200,
          arancel = N(inputs.arancel), iva = N(inputs.iva),
          gastosPuerto = N(inputs.gastosPuerto),
          libBL = N(inputs.liberacionBL), gastosV = N(inputs.gastosVarios),
          decl = N(inputs.declaracion), ingreso = N(inputs.ingresoSistema),
          conserv = N(inputs.conservacion), transporte = N(inputs.transporte),
          unidades = Math.max(N(inputs.unidades), 1);

    const cifUSD = fob + gastosOrigen + flete + seguro;
    const cifCOP = cifUSD * trm;
    const arancelCOP = cifCOP * (arancel / 100);
    const ivaCOP = (cifCOP + arancelCOP) * (iva / 100);
    const subtributos = cifCOP + arancelCOP + ivaCOP;

    // Servicio comex: 0.4% sobre CIF COP, mínimo 800.000
    const servicioComex = Math.max(cifCOP * 0.004, 800000);
    const totalAduana = libBL + gastosV + decl + ingreso + conserv + servicioComex;

    const ivaTransporte = transporte * 0.19;
    const fleteDestCOP = fleteDestino * trm;

    const total = subtributos + gastosPuerto + totalAduana + fleteDestCOP + transporte + ivaTransporte;

    return { cifUSD, cifCOP, arancelCOP, ivaCOP, subtributos, servicioComex, totalAduana, ivaTransporte, total };
  }, [inputs]);

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

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Asistente de Importación</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pre-liquidación estimada de tu importación desde China a Colombia
          </p>
        </div>
        <button
          onClick={exportPDF}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
        >
          {exporting ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
          {exporting ? "Generando PDF..." : "Exportar PDF"}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px,1fr] gap-6">
        {/* ── INPUTS ── */}
        <div className="space-y-4">

          <Section title="Información general" color="bg-blue-50">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Origen">
                <input value={inputs.origen} onChange={e => set("origen", e.target.value)}
                  placeholder="GUANGZHOU"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
              <Field label="Destino">
                <input value={inputs.destino} onChange={e => set("destino", e.target.value)}
                  placeholder="BUENAVENTURA"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Incoterm">
                <select value={inputs.incoterm} onChange={e => set("incoterm", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {["FOB","EXW","CIF","CFR","DAP"].map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Subpartida arancelaria">
                <div className="flex gap-1">
                  <input value={inputs.subpartida} onChange={e => set("subpartida", e.target.value)}
                    placeholder="ej. 8517.13.00"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <a href="https://muisca.dian.gov.co/WebArancel/DefMenuConsultas.faces"
                    target="_blank" rel="noopener noreferrer"
                    title="Consultar DIAN"
                    className="flex-shrink-0 w-9 h-9 flex items-center justify-center border border-gray-200 rounded-lg text-gray-400 hover:text-blue-600 hover:border-blue-300 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
                <p className="text-xs text-gray-400 mt-1">Consulta el arancel en DIAN →</p>
              </Field>
            </div>
          </Section>

          <Section title="Valor de la mercancía (USD)" color="bg-slate-50">
            <Field label="Valor FOB / EXW" hint="Precio en fábrica o en puerto de origen">
              <NumInput value={inputs.fob} onChange={v => set("fob", v)} prefix="$" />
            </Field>
            <Field label="Gastos en origen" hint="Transporte interno, documentación">
              <NumInput value={inputs.gastosOrigen} onChange={v => set("gastosOrigen", v)} prefix="$" />
            </Field>
            <Field label="Flete internacional" hint="China → Colombia">
              <NumInput value={inputs.flete} onChange={v => set("flete", v)} prefix="$" />
            </Field>
            <Field label="Seguro de carga">
              <NumInput value={inputs.seguro} onChange={v => set("seguro", v)} prefix="$" />
            </Field>
          </Section>

          <Section title="Impuestos (sobre base CIF)" color="bg-amber-50">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Arancel" hint="Verificar en DIAN">
                <NumInput value={inputs.arancel} onChange={v => set("arancel", v)} suffix="%" />
              </Field>
              <Field label="IVA">
                <NumInput value={inputs.iva} onChange={v => set("iva", v)} suffix="%" />
              </Field>
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

          <Section title="Configuración" color="bg-purple-50">
            <div className="grid grid-cols-2 gap-3">
              <Field label="TRM (COP por USD)">
                <NumInput value={inputs.trm} onChange={v => set("trm", v)} placeholder="4200" />
              </Field>
              <Field label="Número de unidades">
                <NumInput value={inputs.unidades} onChange={v => set("unidades", v)} placeholder="1" />
              </Field>
            </div>
          </Section>
        </div>

        {/* ── RESULTADO INTERACTIVO ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sticky top-4">
            <h2 className="font-bold text-gray-900 mb-4 text-base">Pre-liquidación</h2>

            <div className="divide-y divide-gray-50 space-y-1">
              {/* CIF */}
              <div className="pb-3">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Valor CIF / Base gravable</p>
                <ResultRow label="Valor mercancía + gastos origen" usd={N(inputs.fob) + N(inputs.gastosOrigen)} />
                <ResultRow label="+ Flete + seguro" usd={N(inputs.flete) + N(inputs.seguro)} sub />
                <ResultRow label="= CIF Total" usd={r.cifUSD} cop={r.cifCOP} bold />
              </div>

              {/* Impuestos */}
              <div className="py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Impuestos aduaneros</p>
                <ResultRow label={`Arancel (${inputs.arancel}%)`} cop={r.arancelCOP} sub />
                <ResultRow label={`IVA (${inputs.iva}%)`} cop={r.ivaCOP} sub />
                <ResultRow label="= Subtotal tributos" cop={r.subtributos} bold />
              </div>

              {/* Gastos */}
              <div className="py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Gastos en Colombia</p>
                <ResultRow label="Gastos puerto" cop={N(inputs.gastosPuerto)} sub />
                <ResultRow label="Aduana (total)" cop={N(inputs.liberacionBL) + N(inputs.gastosVarios) + N(inputs.declaracion) + N(inputs.ingresoSistema) + N(inputs.conservacion) + r.servicioComex} sub />
                <ResultRow label="Serv. comercio exterior (0.4%)" cop={r.servicioComex} sub />
                <ResultRow label="Transporte terrestre + IVA" cop={N(inputs.transporte) + r.ivaTransporte} sub />
              </div>

              {/* Total */}
              <div className="pt-3">
                <ResultRow label="TOTAL OPERACIÓN" cop={r.total} bold />
              </div>
            </div>

            {N(inputs.unidades) > 1 && (
              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="bg-blue-600 rounded-xl p-3 text-center text-white">
                  <p className="text-xs font-semibold opacity-80 mb-0.5">Costo / unidad</p>
                  <p className="text-xl font-bold font-mono">$ {fmt(r.total / N(inputs.unidades))}</p>
                  <p className="text-xs opacity-70">COP</p>
                </div>
                <div className="bg-slate-100 rounded-xl p-3 text-center">
                  <p className="text-xs font-semibold text-gray-500 mb-0.5">Costo / unidad</p>
                  <p className="text-xl font-bold text-gray-800 font-mono">
                    {fmt(r.total / N(inputs.unidades) / (N(inputs.trm) || 4200), 2)}
                  </p>
                  <p className="text-xs text-gray-400">USD</p>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 text-center mt-4">
              * Estimado. Consulta con tu asesor para valores exactos.
            </p>
          </div>
        </div>
      </div>

      {/* ── Hidden print sheet for PDF ── */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none">
        <div ref={printRef}>
          <PrintSheet data={{ inputs: { ...inputs, fob: N(inputs.fob), gastosOrigen: N(inputs.gastosOrigen), flete: N(inputs.flete), seguro: N(inputs.seguro), fleteDestino: N(inputs.fleteDestino), trm: N(inputs.trm) || 4200, arancel: N(inputs.arancel), iva: N(inputs.iva), gastosPuerto: N(inputs.gastosPuerto), liberacionBL: N(inputs.liberacionBL), gastosVarios: N(inputs.gastosVarios), declaracion: N(inputs.declaracion), ingresoSistema: N(inputs.ingresoSistema), conservacion: N(inputs.conservacion), transporte: N(inputs.transporte), unidades: Math.max(N(inputs.unidades), 1) }, r }} client_name={session.client_name} />
        </div>
      </div>
    </div>
  );
}
