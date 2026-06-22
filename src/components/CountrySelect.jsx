import { useState, useRef, useEffect } from "react";

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Angola","Argentina","Armenia","Australia","Austria",
  "Azerbaijan","Bangladesh","Belarus","Belgium","Belize","Bolivia","Bosnia and Herzegovina",
  "Brazil","Bulgaria","Cambodia","Cameroon","Canada","Chile","China","Colombia","Congo",
  "Costa Rica","Croatia","Cuba","Czech Republic","Denmark","Dominican Republic","Ecuador",
  "Egypt","El Salvador","Estonia","Ethiopia","Finland","France","Georgia","Germany","Ghana",
  "Greece","Guatemala","Honduras","Hong Kong","Hungary","India","Indonesia","Iran","Iraq",
  "Ireland","Israel","Italy","Japan","Jordan","Kazakhstan","Kenya","Kuwait","Latvia",
  "Lebanon","Libya","Lithuania","Luxembourg","Malaysia","Mexico","Morocco","Myanmar",
  "Nepal","Netherlands","New Zealand","Nicaragua","Nigeria","Norway","Pakistan","Panama",
  "Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia",
  "Saudi Arabia","Senegal","Serbia","Singapore","Slovakia","Slovenia","South Africa",
  "South Korea","Spain","Sri Lanka","Sweden","Switzerland","Syria","Taiwan","Thailand",
  "Tunisia","Turkey","Ukraine","United Arab Emirates","United Kingdom","United States",
  "Uruguay","Uzbekistan","Venezuela","Vietnam","Yemen","Zimbabwe",
];

export default function CountrySelect({ value, onChange, placeholder = "Search country…", className = "" }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState(value || "");
  const ref = useRef(null);

  // Sync query when value changes externally (e.g. AI fill)
  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = query
    ? COUNTRIES.filter(c => c.toLowerCase().includes(query.toLowerCase()))
    : COUNTRIES;

  const select = (country) => {
    onChange(country);
    setQuery(country);
    setOpen(false);
  };

  const handleChange = (e) => {
    setQuery(e.target.value);
    setOpen(true);
    if (!e.target.value) onChange("");
  };

  const handleBlur = () => {
    // If the typed value exactly matches a country keep it, otherwise clear
    if (query && !COUNTRIES.includes(query)) {
      // try partial match
      const match = COUNTRIES.find(c => c.toLowerCase() === query.toLowerCase());
      if (match) { onChange(match); setQuery(match); }
    }
  };

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-lg shadow-xl max-h-48 overflow-auto text-sm">
          {filtered.slice(0, 40).map(country => (
            <li
              key={country}
              onMouseDown={() => select(country)}
              className={`px-3 py-2 cursor-pointer transition-colors ${
                country === value
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-darkblack-700 dark:text-bgray-200 hover:bg-bgray-50 dark:hover:bg-darkblack-500"
              }`}
            >
              {country}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
