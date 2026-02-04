import { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';

const WASTE_TYPES = {
  komunal: { label: 'Komunálny', color: 'slate', bgClass: 'bg-slate-500', textClass: 'text-slate-700', lightBg: 'bg-slate-100', icon: '🗑️' },
  plast: { label: 'Plasty', color: 'yellow', bgClass: 'bg-yellow-500', textClass: 'text-yellow-700', lightBg: 'bg-yellow-100', icon: '♻️' },
  papier: { label: 'Papier', color: 'blue', bgClass: 'bg-blue-500', textClass: 'text-blue-700', lightBg: 'bg-blue-100', icon: '📄' },
};

const DAYS_SK = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
const DAYS_SHORT = ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'];
const MONTHS_SK = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December'];

// Format date to YYYY-MM-DD in local timezone (not UTC)
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function WasteCalendar({ showToast }) {
  const [pickups, setPickups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPickup, setEditingPickup] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  
  // Form state
  const [formMode, setFormMode] = useState('single'); // 'single' or 'series'
  const [formData, setFormData] = useState({
    waste_type: 'komunal',
    pickup_date: '',
    // Series fields
    start_date: '',
    day_of_week: 0,
    period_weeks: 2,
    count: 12,
  });

  const loadPickups = async () => {
    try {
      // Load 3 months of data
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 2, 0);
      
      const data = await api.getWastePickups({
        from: formatDateLocal(startDate),
        to: formatDateLocal(endDate),
      });
      setPickups(data);
    } catch (err) {
      showToast?.('Nepodarilo sa načítať vývozy', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPickups();
  }, [currentMonth]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    
    // Add days from previous month to fill first week
    const startDayOfWeek = firstDay.getDay();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }
    
    // Add days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push({
        date: new Date(year, month, day),
        isCurrentMonth: true,
      });
    }
    
    // Add days from next month to fill last week
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }
    
    return days;
  }, [currentMonth]);

  // Map pickups to dates
  const pickupsByDate = useMemo(() => {
    const map = {};
    pickups.forEach(pickup => {
      const dateKey = pickup.pickup_date.split('T')[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(pickup);
    });
    return map;
  }, [pickups]);

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDayClick = (day) => {
    const dateKey = formatDateLocal(day.date);
    const dayPickups = pickupsByDate[dateKey] || [];
    
    if (dayPickups.length > 0) {
      // Show existing pickups
      setSelectedDate({ date: day.date, pickups: dayPickups });
    } else {
      // Open add modal with this date
      setFormData(prev => ({
        ...prev,
        pickup_date: dateKey,
        start_date: dateKey,
      }));
      setShowAddModal(true);
    }
  };

  const handleAddPickup = async (e) => {
    e.preventDefault();
    
    try {
      if (formMode === 'single') {
        await api.createWastePickup({
          pickup_date: formData.pickup_date,
          waste_type: formData.waste_type,
        });
        showToast?.('Vývoz pridaný');
      } else {
        const result = await api.createWasteSeries({
          waste_type: formData.waste_type,
          start_date: formData.start_date,
          day_of_week: parseInt(formData.day_of_week),
          period_weeks: parseInt(formData.period_weeks),
          count: parseInt(formData.count),
        });
        showToast?.(`Vytvorených ${result.created} vývozov`);
      }
      
      setShowAddModal(false);
      setFormData({
        waste_type: 'komunal',
        pickup_date: '',
        start_date: '',
        day_of_week: 0,
        period_weeks: 2,
        count: 12,
      });
      loadPickups();
    } catch (err) {
      showToast?.(err.message || 'Nepodarilo sa pridať vývoz', 'error');
    }
  };

  const handleEditPickup = (pickup) => {
    setEditingPickup(pickup);
    setFormData(prev => ({
      ...prev,
      waste_type: pickup.waste_type,
      pickup_date: pickup.pickup_date.split('T')[0],
    }));
    setSelectedDate(null);
    setShowEditModal(true);
  };

  const handleUpdatePickup = async (e) => {
    e.preventDefault();
    
    try {
      await api.updateWastePickup(editingPickup.id, {
        pickup_date: formData.pickup_date,
        waste_type: formData.waste_type,
      });
      showToast?.('Vývoz aktualizovaný');
      setShowEditModal(false);
      setEditingPickup(null);
      loadPickups();
    } catch (err) {
      showToast?.(err.message || 'Nepodarilo sa aktualizovať', 'error');
    }
  };

  const handleDeletePickup = async (pickup) => {
    try {
      await api.deleteWastePickup(pickup.id);
      showToast?.('Vývoz zmazaný');
      setSelectedDate(null);
      loadPickups();
    } catch (err) {
      showToast?.(err.message || 'Nepodarilo sa zmazať', 'error');
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Kalendár vývozov</h2>
          <p className="text-sm text-slate-500">Prehľad a správa termínov vývozu odpadu</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Pridať vývoz
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {Object.entries(WASTE_TYPES).map(([key, type]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${type.bgClass}`} />
            <span className="text-sm text-slate-600">{type.icon} {type.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Month navigation */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <h3 className="text-lg font-semibold text-slate-800">
            {MONTHS_SK[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>

        {/* Days header */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {DAYS_SHORT.map(day => (
            <div key={day} className="p-2 text-center text-xs font-medium text-slate-400 uppercase">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="p-12 text-center text-slate-400">Načítavam...</div>
        ) : (
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dateKey = formatDateLocal(day.date);
              const dayPickups = pickupsByDate[dateKey] || [];
              const isToday = day.date.getTime() === today.getTime();
              const isPast = day.date < today;
              
              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(day)}
                  className={`min-h-[80px] p-1.5 border-b border-r border-slate-100 cursor-pointer transition hover:bg-slate-50 ${
                    !day.isCurrentMonth ? 'bg-slate-50/50' : ''
                  } ${isPast && day.isCurrentMonth ? 'opacity-60' : ''}`}
                >
                  <div className={`text-sm mb-1 ${
                    isToday
                      ? 'w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center'
                      : day.isCurrentMonth
                        ? 'text-slate-700'
                        : 'text-slate-300'
                  }`}>
                    {day.date.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayPickups.map(pickup => {
                      const type = WASTE_TYPES[pickup.waste_type];
                      return (
                        <div
                          key={pickup.id}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${type.lightBg} ${type.textClass} truncate`}
                        >
                          {type.icon} {type.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected date detail modal */}
      {selectedDate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">
                  {selectedDate.date.toLocaleDateString('sk-SK', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long' 
                  })}
                </h3>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {selectedDate.pickups.map(pickup => {
                const type = WASTE_TYPES[pickup.waste_type];
                return (
                  <div key={pickup.id} className={`p-3 rounded-xl ${type.lightBg} border border-${type.color}-200`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{type.icon}</span>
                        <span className={`font-medium ${type.textClass}`}>{type.label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditPickup(pickup)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white/50 rounded-lg transition"
                          title="Upraviť"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeletePickup(pickup)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white/50 rounded-lg transition"
                          title="Zmazať"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    {pickup.notes && (
                      <p className="text-sm text-slate-500 mt-1">{pickup.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => {
                  const dateKey = formatDateLocal(selectedDate.date);
                  setFormData(prev => ({ ...prev, pickup_date: dateKey, start_date: dateKey }));
                  setSelectedDate(null);
                  setShowAddModal(true);
                }}
                className="w-full px-4 py-2 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Pridať ďalší vývoz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <form onSubmit={handleAddPickup}>
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800">Pridať vývoz</h3>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Mode toggle */}
                <div className="flex bg-slate-100 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setFormMode('single')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
                      formMode === 'single' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Jednorazový
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormMode('series')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
                      formMode === 'series' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Opakujúci sa
                  </button>
                </div>

                {/* Waste type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Typ odpadu</label>
                  <div className="flex gap-2">
                    {Object.entries(WASTE_TYPES).map(([key, type]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, waste_type: key }))}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition border-2 ${
                          formData.waste_type === key
                            ? `${type.lightBg} ${type.textClass} border-current`
                            : 'bg-slate-50 text-slate-500 border-transparent hover:border-slate-200'
                        }`}
                      >
                        {type.icon} {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {formMode === 'single' ? (
                  /* Single date */
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Dátum</label>
                    <input
                      type="date"
                      value={formData.pickup_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, pickup_date: e.target.value }))}
                      required
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition cursor-pointer"
                    />
                  </div>
                ) : (
                  /* Series fields */
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Začať od</label>
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                        required
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition cursor-pointer"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Deň v týždni</label>
                        <div className="relative">
                          <select
                            value={formData.day_of_week}
                            onChange={(e) => setFormData(prev => ({ ...prev, day_of_week: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition appearance-none cursor-pointer pr-10"
                          >
                            {DAYS_SK.map((day, idx) => (
                              <option key={idx} value={idx}>{day}</option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M6 9l6 6 6-6"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Každých</label>
                        <div className="relative">
                          <select
                            value={formData.period_weeks}
                            onChange={(e) => setFormData(prev => ({ ...prev, period_weeks: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition appearance-none cursor-pointer pr-10"
                          >
                            <option value="1">1 týždeň</option>
                            <option value="2">2 týždne</option>
                            <option value="3">3 týždne</option>
                            <option value="4">4 týždne</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M6 9l6 6 6-6"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Počet vývozov</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.count}
                        onChange={(e) => setFormData(prev => ({ ...prev, count: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </>
                )}

              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 bg-white text-slate-700 rounded-xl font-medium hover:bg-slate-100 transition border border-slate-200"
                >
                  Zrušiť
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition"
                >
                  {formMode === 'single' ? 'Pridať' : 'Vygenerovať'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <form onSubmit={handleUpdatePickup}>
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800">Upraviť vývoz</h3>
                  <button
                    type="button"
                    onClick={() => { setShowEditModal(false); setEditingPickup(null); }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Waste type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Typ odpadu</label>
                  <div className="flex gap-2">
                    {Object.entries(WASTE_TYPES).map(([key, type]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, waste_type: key }))}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition border-2 ${
                          formData.waste_type === key
                            ? `${type.lightBg} ${type.textClass} border-current`
                            : 'bg-slate-50 text-slate-500 border-transparent hover:border-slate-200'
                        }`}
                      >
                        {type.icon} {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Dátum</label>
                  <input
                    type="date"
                    value={formData.pickup_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, pickup_date: e.target.value }))}
                    required
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingPickup(null); }}
                  className="flex-1 px-4 py-2.5 bg-white text-slate-700 rounded-xl font-medium hover:bg-slate-100 transition border border-slate-200"
                >
                  Zrušiť
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition"
                >
                  Uložiť
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
