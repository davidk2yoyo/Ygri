import React, { useState, useMemo } from "react";

const INCOTERMS = ["FOB", "CIF", "EXW", "CFR", "DAP"];

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, placeholder = "0", prefix }) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{prefix}</span>
      )}
      <input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full border border-gray-300 rounded-lg py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${prefix ? "pl-7 pr-3" : "px-3"}`}
      />
    </div>
  );
}

function ResultRow({ label, value, currency = "USD", bold = false, indent = false }) {
  const formatted = Number(value || 0).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className={`flex items-center justify-between py-2 ${indent ? "pl-4 border-l-2 border-gray-100" : ""}`}>
      <span className={`text-sm ${bold ? "font-semibold text-gray-900" : "text-gray-600"} ${indent ? "text-xs" : ""}`}>
        {label}
      </span>
      <span className={`text-sm font-mono ${bold ? "font-bold text-gray-900" : "text-gray-700"}`}>
        {currency === "COP" ? "$" : "$"} {currency === "COP" ? Number(value || 0).toLocaleString("es-CO") : formatted} {currency}
      </span>
    </div>
  );
}

export default function CalculadoraPage() {
  // Inputs
  const [incoterm, setIncoterm] = useState("FOB");
  const [valorFOB, setValorFOB] = useState("");
  const [flete, setFlete] = useState("");
  const [seguro, setSeguro] = useState("");
  const [arancel, setArancel] = useState("15");       // % arancel importación
  const [iva, setIva] = useState("19");               // % IVA Colombia
  const [gastosAgente, setGastosAgente] = useState("");
  const [gastosLocales, setGastosLocales] = useState("");
  const [otrosGastos, setOtrosGastos] = useState("");
  const [trmUSD, setTrmUSD] = useState("4200");       // TRM COP/USD
  const [unidades, setUnidades] = useState("1");

  const n = v => parseFloat(v) || 0;

  const calc = useMemo(() => {
    const fob = n(valorFOB);
    const freight = n(flete);
    const insurance = n(seguro);
    const trm = n(trmUSD) || 4200;
    const units = Math.max(n(unidades), 1);

    // CIF = FOB + flete + seguro (si EXW, el flete ya incluye transporte origen)
    const cif = fob + freight + insurance;

    // Base gravable = CIF en COP
    const cifCOP = cif * trm;

    // Arancel sobre base CIF
    const arancelAmt = cifCOP * (n(arancel) / 100);

    // IVA sobre (CIF + arancel)
    const ivaAmt = (cifCOP + arancelAmt) * (n(iva) / 100);

    // Tributos aduaneros
    const tributosAduana = arancelAmt + ivaAmt;

    // Gastos adicionales en USD → COP
    const agente = n(gastosAgente);
    const locales = n(gastosLocales);
    const otros = n(otrosGastos);
    const gastosExtra = (agente + locales + otros) * trm;

    const totalCOP = cifCOP + tributosAduana + gastosExtra;
    const costoUnitCOP = totalCOP / units;
    const costoUnitUSD = costoUnitCOP / trm;

    return { cif, cifCOP, arancelAmt, ivaAmt, tributosAduana, gastosExtra, totalCOP, costoUnitCOP, costoUnitUSD };
  }, [valorFOB, flete, seguro, arancel, iva, gastosAgente, gastosLocales, otrosGastos, trmUSD, unidades]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Calculadora de Importación</h1>
        <p className="text-sm text-gray-500 mt-0.5">Estima el costo total de tu importación desde China a Colombia</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Inputs ── */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Valor de la mercancía (USD)</h2>
            <div className="space-y-4">
              <Field label="Incoterm">
                <select
                  value={incoterm}
                  onChange={e => setIncoterm(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {INCOTERMS.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Valor FOB / EXW" hint="Precio de la mercancía en origen">
                <NumberInput value={valorFOB} onChange={setValorFOB} prefix="$" />
              </Field>
              <Field label="Flete internacional" hint="Costo de transporte China → Colombia">
                <NumberInput value={flete} onChange={setFlete} prefix="$" />
              </Field>
              <Field label="Seguro de carga" hint="Dejar en 0 si no aplica">
                <NumberInput value={seguro} onChange={setSeguro} prefix="$" />
              </Field>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Tributos y gastos Colombia</h2>
            <div className="space-y-4">
              <Field label="Arancel de importación (%)" hint="Varía según subpartida arancelaria">
                <NumberInput value={arancel} onChange={setArancel} placeholder="15" />
              </Field>
              <Field label="IVA (%)" hint="Generalmente 19% en Colombia">
                <NumberInput value={iva} onChange={setIva} placeholder="19" />
              </Field>
              <Field label="Gastos agente de aduana (USD)">
                <NumberInput value={gastosAgente} onChange={setGastosAgente} prefix="$" />
              </Field>
              <Field label="Gastos locales / bodegaje (USD)">
                <NumberInput value={gastosLocales} onChange={setGastosLocales} prefix="$" />
              </Field>
              <Field label="Otros gastos (USD)">
                <NumberInput value={otrosGastos} onChange={setOtrosGastos} prefix="$" />
              </Field>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Configuración</h2>
            <div className="space-y-4">
              <Field label="TRM (COP por 1 USD)">
                <NumberInput value={trmUSD} onChange={setTrmUSD} placeholder="4200" />
              </Field>
              <Field label="Número de unidades" hint="Para calcular costo por unidad">
                <NumberInput value={unidades} onChange={setUnidades} placeholder="1" />
              </Field>
            </div>
          </div>
        </div>

        {/* ── Resultados ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Resumen de costos</h2>

            <div className="divide-y divide-gray-100">
              <div className="pb-3 space-y-0.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Valor en aduana</p>
                <ResultRow label="Valor FOB" value={n(valorFOB)} />
                <ResultRow label="+ Flete" value={n(flete)} indent />
                <ResultRow label="+ Seguro" value={n(seguro)} indent />
                <ResultRow label="= Valor CIF (USD)" value={calc.cif} bold />
                <ResultRow label="Valor CIF (COP)" value={calc.cifCOP} currency="COP" />
              </div>

              <div className="py-3 space-y-0.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tributos aduaneros</p>
                <ResultRow label={`Arancel (${arancel}%)`} value={calc.arancelAmt} currency="COP" indent />
                <ResultRow label={`IVA (${iva}%)`} value={calc.ivaAmt} currency="COP" indent />
                <ResultRow label="Total tributos" value={calc.tributosAduana} currency="COP" bold />
              </div>

              <div className="py-3 space-y-0.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Gastos adicionales</p>
                <ResultRow label="Agente + locales + otros" value={calc.gastosExtra} currency="COP" indent />
              </div>

              <div className="pt-3">
                <ResultRow label="COSTO TOTAL" value={calc.totalCOP} currency="COP" bold />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-blue-600 font-medium mb-1">Costo por unidad</p>
                    <p className="text-lg font-bold text-blue-700">
                      $ {Math.round(calc.costoUnitCOP).toLocaleString("es-CO")}
                    </p>
                    <p className="text-xs text-blue-500">COP</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 font-medium mb-1">Costo por unidad</p>
                    <p className="text-lg font-bold text-gray-700">
                      $ {calc.costoUnitUSD.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400">USD</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-4 text-center">
              * Cálculo estimado. Consulta con tu asesor para cifras exactas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
