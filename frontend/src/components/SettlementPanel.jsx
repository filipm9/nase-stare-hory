import { useState, useEffect } from 'react';
import { api } from '../api/client';

// Water meter definitions - presne podla excelu
const WATER_METERS = [
  { 
    key: 'main_cold', 
    label: 'STUDENÁ - fakturačný vodomer', 
    unit: 'm³', 
    location: 'Benny sklep',
    description: 'fakturačný vodomer' 
  },
  { 
    key: 'benny_irrigation', 
    label: 'STUDENÁ - podružný vodomer zálievka Benny', 
    unit: 'm³', 
    location: 'Benny sklep',
    description: 'podružný vodomer zálievka Benny' 
  },
  { 
    key: 'filip_cold', 
    label: 'STUDENÁ - podružný vodomer Filip', 
    unit: 'm³', 
    location: 'Filip sklep',
    description: 'podružný vodomer Filip' 
  },
  { 
    key: 'filip_irrigation', 
    label: 'STUDENÁ - podružný vodomer zálievka Filip', 
    unit: 'm³', 
    location: 'Filip sklep',
    description: 'podružný vodomer zálievka Filip' 
  },
  { 
    key: 'benny_hot', 
    label: 'TEPLÁ - vodomer teplej vody Benny', 
    unit: 'm³', 
    location: 'Filip sklep',
    description: 'vodomer teplej vody Benny' 
  },
  { 
    key: 'filip_hot', 
    label: 'TEPLÁ - vodomer teplej vody Filip', 
    unit: 'm³', 
    location: 'Filip sklep',
    description: 'vodomer teplej vody Filip' 
  },
];

// Electricity meter definitions - presne podla excelu
const ELECTRICITY_METERS = [
  { 
    key: 'main_electric', 
    label: 'PILIER VPRAVO - fakturačný elektromer', 
    unit: 'kWh', 
    location: 'Pilier VPRAVO',
    description: 'fakturačný elektromer per celý RD' 
  },
  { 
    key: 'filip_electric', 
    label: 'PILIER STREDNÝ - podružný elektromer pre Filip', 
    unit: 'kWh', 
    location: 'Pilier STREDNÝ',
    description: 'podružný elektromer pre Filip' 
  },
  { 
    key: 'common_electric', 
    label: 'PILIER VĽAVO - podružný elektromer pre spoločnú spotrebu', 
    unit: 'kWh', 
    location: 'Pilier VĽAVO',
    description: 'podružný elektromer pre spoločnú spotrebu' 
  },
];

const CALORIMETER_METERS = [
  { 
    key: 'benny_heating', 
    label: 'Kalorimeter topnej vody pre Benny', 
    unit: 'GJ', 
    location: '',
    description: 'kalorimeter topnej vody pre Benny' 
  },
  { 
    key: 'filip_heating', 
    label: 'Kalorimeter topnej vody pre Filip', 
    unit: 'GJ', 
    location: '',
    description: 'kalorimeter topnej vody pre Filip' 
  },
  { 
    key: 'hot_water_cal', 
    label: 'Kalorimeter pre teplú vodu', 
    unit: 'GJ', 
    location: '',
    description: 'kalorimeter pre teplú vodu' 
  },
];

const HOT_WATER_METERS = [
  { 
    key: 'benny_hot_water', 
    label: 'Vodomer teplej vody pre Benny', 
    unit: 'm³', 
    location: '',
    description: 'vodomer teplej vody pre Benny' 
  },
  { 
    key: 'filip_hot_water', 
    label: 'Vodomer teplej vody pre Filip', 
    unit: 'm³', 
    location: '',
    description: 'vodomer teplej vody pre Filip' 
  },
];

function MeterInput({ meter, readings, onChange, disabled }) {
  const value = readings[meter.key] || { previous: '', current: '' };
  const consumption = (parseFloat(value.current) || 0) - (parseFloat(value.previous) || 0);
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium text-slate-800">{meter.label}</h4>
          {meter.location && (
            <p className="text-xs text-blue-600 font-medium mt-0.5">📍 {meter.location}</p>
          )}
        </div>
        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded">
          {meter.unit}
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Minulý stav</label>
          <input
            type="number"
            step="0.001"
            value={value.previous}
            onChange={(e) => onChange(meter.key, 'previous', e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none disabled:bg-slate-100 disabled:border-slate-200"
            placeholder="0.000"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Aktuálny stav</label>
          <input
            type="number"
            step="0.001"
            value={value.current}
            onChange={(e) => onChange(meter.key, 'current', e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 bg-amber-100 border border-amber-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none disabled:bg-slate-100 disabled:border-slate-200"
            placeholder="0.000"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Spotreba</label>
          <div className={`w-full px-3 py-2 rounded-lg text-sm font-medium ${
            consumption > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-200'
          }`}>
            {consumption.toFixed(meter.unit === 'GJ' ? 3 : 2)} {meter.unit}
          </div>
        </div>
      </div>
    </div>
  );
}

function CalculationSteps({ steps }) {
  if (!steps || steps.length === 0) return null;
  
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-5 py-3 border-b border-slate-200">
        <h3 className="font-semibold text-slate-800">Výpočet - všetky kroky</h3>
        <p className="text-xs text-slate-500 mt-0.5">Transparentný prehľad celého výpočtu</p>
      </div>
      <div className="divide-y divide-slate-100">
        {steps.map((step, idx) => {
          if (step.section) {
            return (
              <div key={idx} className="bg-slate-50 px-5 py-2">
                <span className="text-sm font-semibold text-slate-600">{step.label}</span>
              </div>
            );
          }
          
          const value = step.value !== null 
            ? (typeof step.value === 'number' 
                ? step.value.toFixed(step.unit === 'GJ' ? 4 : step.unit === '%' ? 2 : 2)
                : step.value)
            : '-';
          
          return (
            <div 
              key={idx} 
              className={`px-5 py-2.5 flex items-center justify-between ${
                step.highlight ? 'bg-emerald-50' : ''
              }`}
            >
              <span className={`text-sm ${step.highlight ? 'font-semibold text-emerald-800' : 'text-slate-600'}`}>
                {step.label}
              </span>
              <span className={`text-sm font-mono ${step.highlight ? 'font-bold text-emerald-700' : 'text-slate-800'}`}>
                {value} {step.unit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PaymentSummary({ calculation, type }) {
  if (!calculation?.summary) return null;
  
  const { summary } = calculation;
  const bennyPayment = summary.benny?.payment || 0;
  const filipPayment = summary.filip?.payment || 0;
  
  return (
    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
          <line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
        Výsledok vyúčtovania
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/10 rounded-xl p-4">
          <p className="text-emerald-100 text-sm mb-1">Benny</p>
          <p className="text-2xl font-bold">
            {bennyPayment > 0 ? '+' : ''}{bennyPayment.toFixed(0)} Kč
          </p>
          <p className="text-emerald-100 text-xs mt-1">
            {bennyPayment > 0 ? 'Doplatiť' : 'Preplatok'}
          </p>
        </div>
        <div className="bg-white/10 rounded-xl p-4">
          <p className="text-emerald-100 text-sm mb-1">Filip</p>
          <p className="text-2xl font-bold">
            {filipPayment > 0 ? '+' : ''}{filipPayment.toFixed(0)} Kč
          </p>
          <p className="text-emerald-100 text-xs mt-1">
            {filipPayment > 0 ? 'Doplatiť' : 'Preplatok'}
          </p>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-white/20">
        <div className="flex items-center justify-between text-sm">
          <span className="text-emerald-100">Spotreba {type === 'water' ? 'vody' : 'elektriny'}:</span>
          <span className="font-semibold">
            {(summary.total?.consumption || 0).toFixed(2)} {type === 'water' ? 'm³' : 'kWh'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-emerald-100">Pomer Benny / Filip:</span>
          <span className="font-semibold">
            {(summary.benny?.percent || 0).toFixed(1)}% / {(summary.filip?.percent || 0).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SettlementPanel({ showToast }) {
  const [activeType, setActiveType] = useState('water');
  const [settlements, setSettlements] = useState([]);
  const [currentSettlement, setCurrentSettlement] = useState(null);
  const [previousSettlement, setPreviousSettlement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [completing, setCompleting] = useState(false);
  
  // Form state
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [readings, setReadings] = useState({});
  const [financials, setFinancials] = useState({ advances: '', invoiced: '' });
  
  // Load settlements when type or year changes
  useEffect(() => {
    loadData();
  }, [activeType, periodYear]);
  
  const loadData = async () => {
    setLoading(true);
    try {
      const [allSettlements, latest] = await Promise.all([
        api.getSettlements(activeType),
        api.getLatestSettlement(activeType),
      ]);
      
      setSettlements(allSettlements);
      setPreviousSettlement(latest);
      
      // Check for existing settlement for current year (draft or completed)
      const existing = allSettlements.find(s => s.period_year === periodYear);
      
      if (existing) {
        // Load existing settlement (whether draft or completed)
        setCurrentSettlement(existing);
        setReadings(existing.readings || {});
        setFinancials(existing.financials || { advances: '', invoiced: '' });
      } else {
        // No settlement for this year - create new
        setCurrentSettlement(null);
        // Pre-fill previous values from last completed settlement
        if (latest) {
          const prevReadings = {};
          const latestReadings = latest.readings || {};
          
          // Copy current values as previous values for new period
          Object.keys(latestReadings).forEach(key => {
            prevReadings[key] = {
              previous: latestReadings[key]?.current || '',
              current: '',
            };
          });
          setReadings(prevReadings);
        } else {
          setReadings({});
        }
        setFinancials({ advances: '', invoiced: '' });
      }
    } catch (err) {
      console.error('Failed to load settlements:', err);
      showToast?.('Nepodarilo sa načítať vyúčtovania', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleMeterChange = (key, field, value) => {
    setReadings(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };
  
  const handleSave = async () => {
    try {
      const result = await api.saveSettlement({
        settlement_type: activeType,
        period_year: periodYear,
        readings,
        financials,
      });
      setCurrentSettlement(result);
      showToast?.('Uložené', 'success');
    } catch (err) {
      console.error('Failed to save:', err);
      showToast?.('Nepodarilo sa uložiť', 'error');
    }
  };
  
  const handleCalculate = async () => {
    setCalculating(true);
    try {
      // First save
      const saved = await api.saveSettlement({
        settlement_type: activeType,
        period_year: periodYear,
        readings,
        financials,
      });
      
      // Then calculate
      const result = await api.calculateSettlement(saved.id);
      setCurrentSettlement(result);
      showToast?.('Výpočet dokončený', 'success');
    } catch (err) {
      console.error('Failed to calculate:', err);
      showToast?.('Nepodarilo sa vypočítať', 'error');
    } finally {
      setCalculating(false);
    }
  };
  
  const handleComplete = async (sendEmail) => {
    if (!currentSettlement?.calculation) {
      showToast?.('Najprv vypočítajte vyúčtovanie', 'error');
      return;
    }
    
    setCompleting(true);
    try {
      const result = await api.completeSettlement(currentSettlement.id, sendEmail);
      setCurrentSettlement(result);
      setPreviousSettlement(result);
      showToast?.(`Vyúčtovanie dokončené${sendEmail ? ' - email odoslaný' : ''}`, 'success');
      loadData();
    } catch (err) {
      console.error('Failed to complete:', err);
      showToast?.('Nepodarilo sa dokončiť vyúčtovanie', 'error');
    } finally {
      setCompleting(false);
    }
  };
  
  const meters = activeType === 'water' ? WATER_METERS : ELECTRICITY_METERS;
  const isCompleted = currentSettlement?.status === 'completed';
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Type selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveType('water')}
            className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-xl transition flex items-center justify-center gap-2 ${
              activeType === 'water'
                ? 'bg-cyan-500 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/>
            </svg>
            Voda
          </button>
          <button
            onClick={() => setActiveType('electricity')}
            className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-xl transition flex items-center justify-center gap-2 ${
              activeType === 'electricity'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            Elektrina
          </button>
        </div>
      </div>
      
      {/* Period selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">Obdobie vyúčtovania</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {previousSettlement 
                ? `Posledné vyúčtovanie: ${previousSettlement.period_year}` 
                : 'Žiadne predchádzajúce vyúčtovanie'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPeriodYear(y => y - 1)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <span className="text-2xl font-bold text-slate-800 min-w-[80px] text-center">{periodYear}</span>
            <button
              onClick={() => setPeriodYear(y => y + 1)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>
        
        {isCompleted && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span className="text-sm font-medium text-emerald-800">
              Toto vyúčtovanie je dokončené ({new Date(currentSettlement.completed_at).toLocaleDateString('sk-SK')})
            </span>
          </div>
        )}
      </div>
      
      {/* Meter readings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800">
          {activeType === 'water' ? 'Vodomery' : 'Elektromery'}
        </h3>
        
        <div className="grid gap-4">
          {meters.map(meter => (
            <MeterInput
              key={meter.key}
              meter={meter}
              readings={readings}
              onChange={handleMeterChange}
              disabled={isCompleted}
            />
          ))}
        </div>
        
        {/* Extra meters for electricity */}
        {activeType === 'electricity' && (
          <>
            <h3 className="text-lg font-semibold text-slate-800 mt-8">Kalorimetry (teplo)</h3>
            <div className="grid gap-4">
              {CALORIMETER_METERS.map(meter => (
                <MeterInput
                  key={meter.key}
                  meter={meter}
                  readings={readings}
                  onChange={handleMeterChange}
                  disabled={isCompleted}
                />
              ))}
            </div>
            
            <h3 className="text-lg font-semibold text-slate-800 mt-8">Vodomery teplej vody (pre pomer)</h3>
            <div className="grid gap-4">
              {HOT_WATER_METERS.map(meter => (
                <MeterInput
                  key={meter.key}
                  meter={meter}
                  readings={readings}
                  onChange={handleMeterChange}
                  disabled={isCompleted}
                />
              ))}
            </div>
          </>
        )}
      </div>
      
      {/* Financials */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Finančné údaje</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Zaplatené zálohy (spolu)
            </label>
            <div className="relative">
              <input
                type="number"
                value={financials.advances}
                onChange={(e) => setFinancials(f => ({ ...f, advances: e.target.value }))}
                disabled={isCompleted}
                className="w-full px-4 py-2.5 pr-12 bg-amber-50 border border-amber-200 rounded-xl text-lg font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none disabled:bg-slate-100 disabled:border-slate-200"
                placeholder="0"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">Kč</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Vyfakturovaná čiastka
            </label>
            <div className="relative">
              <input
                type="number"
                value={financials.invoiced}
                onChange={(e) => setFinancials(f => ({ ...f, invoiced: e.target.value }))}
                disabled={isCompleted}
                className="w-full px-4 py-2.5 pr-12 bg-amber-100 border border-amber-300 rounded-xl text-lg font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none disabled:bg-slate-100 disabled:border-slate-200"
                placeholder="0"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">Kč</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Action buttons */}
      {!isCompleted && (
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-white text-slate-700 rounded-xl font-medium hover:bg-slate-100 transition border border-slate-200"
          >
            Uložiť draft
          </button>
          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="flex-1 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {calculating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Počítam...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="2" width="16" height="20" rx="2"/>
                  <line x1="8" y1="6" x2="16" y2="6"/>
                  <line x1="8" y1="10" x2="16" y2="10"/>
                  <line x1="8" y1="14" x2="12" y2="14"/>
                </svg>
                Vypočítať
              </>
            )}
          </button>
        </div>
      )}
      
      {/* Calculation results */}
      {currentSettlement?.calculation && (
        <>
          <PaymentSummary calculation={currentSettlement.calculation} type={activeType} />
          <CalculationSteps steps={currentSettlement.calculation.steps} />
          
          {/* Complete buttons */}
          {!isCompleted && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-semibold text-slate-800 mb-2">Dokončiť vyúčtovanie</h3>
              <p className="text-sm text-slate-500 mb-4">
                Po dokončení sa aktuálne hodnoty stanú "minulými" pre ďalšie obdobie a nebude možné vyúčtovanie upraviť.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleComplete(false)}
                  disabled={completing}
                  className="flex-1 px-5 py-2.5 bg-white text-slate-700 rounded-xl font-medium hover:bg-slate-100 transition border border-slate-200 disabled:opacity-50"
                >
                  Dokončiť bez emailu
                </button>
                <button
                  onClick={() => handleComplete(true)}
                  disabled={completing}
                  className="flex-1 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {completing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Dokončujem...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                      </svg>
                      Dokončiť a poslať backup
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      
      {/* History */}
      {settlements.filter(s => s.status === 'completed').length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">História vyúčtovaní</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {settlements
              .filter(s => s.status === 'completed')
              .slice(0, 5)
              .map(s => (
                <div key={s.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <span className="font-medium text-slate-800">{s.period_year}</span>
                    <span className="text-sm text-slate-400 ml-2">
                      {new Date(s.completed_at).toLocaleDateString('sk-SK')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-500">
                      B: {(s.calculation?.summary?.benny?.payment || 0).toFixed(0)} Kč
                    </span>
                    <span className="text-slate-500">
                      F: {(s.calculation?.summary?.filip?.payment || 0).toFixed(0)} Kč
                    </span>
                    {s.email_sent && (
                      <span className="text-emerald-600" title="Email odoslaný">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
