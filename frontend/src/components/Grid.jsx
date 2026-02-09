import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TEAMS } from '../constants';

const cn = (...inputs) => twMerge(clsx(inputs));

const PRESET_EMOJIS = ['🏈', '🏆', '🦅', '🦁', '⭐', '🍺', '🍕', '🐉', '💵', '🎲', '🌶️', '🚀', '👑', '🌈', '🍀', '🦜', '🦄', '🍔', '🌭', '🧀'];

export default function Grid({ config = {} }) {
  const [gridData, setGridData] = useState({ 
    squares: [], 
    axis: { rowLabels: Array(10).fill('?'), colLabels: Array(10).fill('?') },
    teams: { nfc: 'NFC', afc: 'AFC' },
    winners: { q1: '', half: '', q3: '', final: '' },
    locked: false
  });
  const [loading, setLoading] = useState(true);

  const paymentLinks = (config.payments?.links || []).filter(link => link?.url);
  const paymentNotes = config.payments?.notes || '';
  const contactEmail = config.contactEmail || '';
  const costText = `${config.currency || '$'}${config.cost || '20'}`;
  const titleText = config.title || 'Super Bowl Pool';
  
  // Reservation Modal State
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [form, setForm] = useState({ displayName: '', contactInfo: '', emoji: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successSquare, setSuccessSquare] = useState(null);

  const fetchGrid = async () => {
    try {
      const res = await axios.get('api.php?action=grid');
      const payload = (res.data && typeof res.data === 'object') ? res.data : {};
      const squares = Array.isArray(payload.squares) ? payload.squares : [];
      const rowLabels = Array.isArray(payload.axis?.rowLabels) && payload.axis.rowLabels.length === 10
        ? payload.axis.rowLabels
        : Array(10).fill('?');
      const colLabels = Array.isArray(payload.axis?.colLabels) && payload.axis.colLabels.length === 10
        ? payload.axis.colLabels
        : Array(10).fill('?');
      // Ensure we have arrays for labels even if server returns null/undefined initially
      const safeData = {
        ...payload,
        squares,
          axis: {
          rowLabels,
          colLabels
          }
      };
      setGridData(safeData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching grid:', error);
    }
  };

  useEffect(() => {
    fetchGrid();
    const interval = setInterval(fetchGrid, 5000);
    return () => clearInterval(interval);
  }, []);

  const getTeamTheme = (teamName, isRow) => {
    const team = TEAMS[teamName];
    if (team) {
        return {
            container: {
                backgroundColor: team.primary,
                color: '#FFF',
                borderColor: team.accent,
                textShadow: '0 1px 2px rgba(0,0,0,0.5)'
            },
            header: {
                color: team.primary
            }
        };
    }
    // Defaults
    return {
        container: isRow 
            ? { backgroundColor: '#fee2e2', color: '#7f1d1d', borderColor: '#fecaca' } 
            : { backgroundColor: '#dbeafe', color: '#1e3a8a', borderColor: '#bfdbfe' },
        header: isRow
            ? { color: '#991b1b' } 
            : { color: '#1e3a8a' } 
    };
  };

  const getPaymentButtonClasses = (style) => {
    switch ((style || '').toLowerCase()) {
      case 'venmo':
        return 'px-6 py-3 bg-[#008CFF] text-white font-bold rounded-lg hover:bg-[#0074d4] transition shadow-md flex items-center justify-center gap-2';
      case 'paypal':
        return 'px-6 py-3 bg-[#003087] text-white font-bold rounded-lg hover:bg-[#00266b] transition shadow-md flex items-center justify-center gap-2';
      case 'cashapp':
        return 'px-6 py-3 bg-[#00D632] text-white font-bold rounded-lg hover:bg-[#00b92c] transition shadow-md flex items-center justify-center gap-2';
      case 'zelle':
        return 'px-6 py-3 bg-[#6d1ed4] text-white font-bold rounded-lg hover:bg-[#5b18b1] transition shadow-md flex items-center justify-center gap-2';
      default:
        return 'px-6 py-3 bg-slate-600 text-white font-bold rounded-lg hover:bg-slate-700 transition shadow-md flex items-center justify-center gap-2';
    }
  };

  const nfcTheme = getTeamTheme(gridData.teams.nfc, false);
  const afcTheme = getTeamTheme(gridData.teams.afc, true);

  const handleSquareClick = (square) => {
    if (gridData.locked) return; // Pool is locked

    if (square.status === 'available') {
      setSelectedSquare(square);
      setForm({ displayName: '', contactInfo: '', emoji: '' });
    } else {
        alert(square.status === 'confirmed' 
            ? `Reserved by: ${square.display_name}` 
            : `Pending Reservation for: ${square.display_name}`);
    }
  };

  const handleReserve = async (e) => {
    e.preventDefault();
    if (!selectedSquare) return;

    const cleanPhone = form.contactInfo.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      alert("Please enter a valid 10-digit mobile number so we can text you confirmation.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      await axios.post('api.php?action=reserve', {
        rowIndex: selectedSquare.row_index,
        colIndex: selectedSquare.col_index,
        displayName: form.displayName,
        contactInfo: form.contactInfo,
        emoji: form.emoji
      });
      setSuccessSquare(selectedSquare);
      setSelectedSquare(null);
      fetchGrid(); 
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to reserve square. It might be taken!');
      fetchGrid();
    } finally {
      setIsSubmitting(false);
    }
  };

  const findSquare = (r, c) => gridData.squares.find(s => s.row_index === r && s.col_index === c);

  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-900 pb-20 print:bg-white print:pb-0 print-single-page">
      
      {/* Header */}
      <h1 className="text-3xl md:text-5xl text-white print:text-black font-['Russo_One'] uppercase tracking-widest mt-8 mb-6 print:mt-0 print:mb-1 print:text-2xl text-center shadow-black drop-shadow-lg">
        {titleText}
      </h1>

      {/* Scoreboard / Winners Podium */}
      <div className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-4 px-4 mb-8 print:mb-1 print:gap-2 print-compact">
        {[
            { label: 'Q1 Winner', val: gridData.winners?.q1 },
            { label: 'Halftime', val: gridData.winners?.half },
            { label: 'Q3 Winner', val: gridData.winners?.q3 },
            { label: 'Final', val: gridData.winners?.final },
        ].map((w, i) => {
            const isUnsold = w.val && w.val.startsWith('UNSOLD');
            // Assuming default legacy format "Name (NFC X - AFC Y)"
            const parts = w.val ? w.val.match(/^(.*?)\s*(\(.*\))$/) : null;
            const name = parts ? parts[1] : (w.val || 'TBD');
            const score = parts ? parts[2].replace(/[()]/g, '') : '';

            return (
                <div 
                    key={i} 
                    className={cn(
                        "bg-white rounded-lg p-3 text-center shadow-lg border-b-4 flex flex-col justify-between select-none transition-transform hover:-translate-y-1 cursor-pointer active:scale-95", 
                        w.val ? (isUnsold ? "border-slate-400 bg-slate-50" : "border-yellow-400 ring-2 ring-yellow-400/50") : "border-slate-300 opacity-80"
                    )}
                    title={w.val || 'No winner yet'}
                    onClick={() => w.val && alert(`🎉 Winner Detail 🎉\n\n${name}\n${score}`)}
                >
                    <div className="text-xs uppercase font-bold text-gray-500 mb-1 tracking-wider">{w.label}</div>
                    
                    {isUnsold ? (
                         <div className="text-xs font-bold text-gray-500 flex flex-col items-center animate-pulse">
                            <span className="text-base">🏆 &rarr; Fund</span>
                            <span className="text-[10px] font-normal mt-1 opacity-75">{score || 'No Score'}</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                             <div className={cn("font-bold text-sm md:text-base leading-tight truncate w-full", w.val ? "text-slate-900" : "text-gray-300 italic")}>
                                {name}
                            </div>
                            {score && <div className="text-[10px] md:text-xs font-semibold text-gray-500 mt-1">{score}</div>}
                        </div>
                    )}
                </div>
            );
        })}
      </div>

      <div className="bg-slate-100 p-2 md:p-4 rounded-xl shadow-2xl w-full max-w-3xl relative z-10 mx-auto flex flex-col items-center print:shadow-none print:bg-transparent print:p-0 print:max-w-none print:w-[90%] print-grid">
        
        {/* Status Bar */}
        <div className="text-center mb-4 text-sm text-gray-500 w-full print:hidden">
            {gridData.locked ? (
                <div className="bg-red-600 text-white py-2 px-4 rounded font-bold uppercase tracking-widest shadow-md">
                     🔒 POOL LOCKED - GOOD LUCK! 🔒
                </div>
            ) : (
                <>
                    <p className="font-medium text-slate-700">Tap a grey square to reserve it!</p>
                    <div className="flex justify-center gap-4 mt-2 text-xs">
                        <span className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-200 border border-gray-300 rounded-sm"></div> Available</span>
                        <span className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-200 border border-yellow-300 rounded-sm"></div> Pending</span>
                        <span className="flex items-center gap-1"><div className="w-3 h-3 bg-green-600 rounded-sm"></div> Confirmed</span>
                    </div>
                </>
            )}
        </div>

        {/* CSS GRID Container - Sticky Headers Magic */}
        <div className="w-full overflow-auto max-h-[70vh] border rounded shadow-inner bg-white relative print:max-h-none print:overflow-visible print:border-none print:shadow-none">
            <div 
                className="grid" 
                style={{ 
                    gridTemplateColumns: 'minmax(2.5rem, auto) repeat(10, minmax(2.5rem, 1fr))', 
                    // No gridAutoRows needed if we use aspect-square on children
                }}
            >
                {/* 1. TOP-LEFT CORNER (Split Diagonal) */}
                <div 
                    className="sticky top-0 left-0 z-50 border-r-2 border-b-2 border-slate-900 shadow-sm aspect-square"
                    style={{
                        background: `linear-gradient(to bottom right, ${nfcTheme.container.backgroundColor} 50%, ${afcTheme.container.backgroundColor} 50%)`
                    }}
                >
                    <div className="relative w-full h-full">
                        <span className="absolute top-[2px] right-[2px] text-[10px] sm:text-xs font-bold" style={{color: nfcTheme.container.color}}>{gridData.teams.nfc}</span>
                        <span className="absolute bottom-[2px] left-[2px] text-[10px] sm:text-xs font-bold" style={{color: afcTheme.container.color}}>{gridData.teams.afc}</span>
                    </div>
                </div>

                {/* 2. TOP COL HEADERS (Sticky Top) */}
                {gridData.axis.colLabels.map((label, c) => (
                    <div 
                        key={`col-head-${c}`}
                        className="sticky top-0 z-40 flex items-center justify-center font-bold border-r-2 border-b-2 border-slate-900 shadow-sm text-sm md:text-base aspect-square"
                        style={nfcTheme.container}
                    >
                        {label === '?' ? (TEAMS[gridData.teams.nfc]?.emoji || '?') : label}
                    </div>
                ))}

                {/* 3. ROW LOOPS (Row Header + 10 Squares) */}
                {gridData.axis.rowLabels.map((rowLabel, r) => (
                    <React.Fragment key={`row-group-${r}`}>
                        {/* Row Header (Sticky Left) */}
                        <div 
                            className="sticky left-0 z-40 flex items-center justify-center font-bold border-r-2 border-b-2 border-slate-900 shadow-sm text-sm md:text-base aspect-square"
                            style={afcTheme.container}
                        >
                            {rowLabel === '?' ? (TEAMS[gridData.teams.afc]?.emoji || '?') : rowLabel}
                        </div>

                        {/* Squares */}
                        {[...Array(10)].map((_, c) => {
                            const sq = findSquare(r, c);
                            // Fallback if square not found (shouldn't happen)
                            if (!sq) return <div key={`empty-${r}-${c}`} className="bg-gray-100 border border-slate-300 aspect-square"></div>;

                            const isAvailable = sq.status === 'available';
                            const isPending = sq.status === 'pending';
                            const isConfirmed = sq.status === 'confirmed';
                            const isLocked = gridData.locked;

                            // Dead Square Logic
                            const isDead = isLocked && isAvailable;
                            const boxNum = (r * 10) + c + 1;

                            return (
                                <div
                                    key={sq.id}
                                    onClick={() => !isDead && handleSquareClick(sq)}
                                    className={cn(
                                        "group border-r border-b border-slate-400 flex items-center justify-center text-[10px] relative transition-colors aspect-square",
                                        // Specific square styling
                                        isDead && "bg-slate-300 text-slate-400 cursor-not-allowed opacity-60 shadow-inner",
                                        isAvailable && !isLocked && "bg-slate-100 hover:bg-white cursor-pointer hover:shadow-inner hover:z-10 shadow-inner",
                                        isAvailable && isLocked && !isDead && "bg-slate-100 cursor-not-allowed opacity-50 shadow-inner", // Fallback if not dead? (Actually redundant but keeping for safety)
                                        isPending && "bg-yellow-100 text-yellow-800 font-medium",
                                        isConfirmed && "bg-emerald-50 text-emerald-900 font-bold",
                                        (isConfirmed || isPending) && "shadow-sm"
                                    )}
                                >
                                    {/* Box Number */}
                                    <span className="absolute top-[2px] left-[2px] text-[8px] leading-none text-slate-400/60 font-sans select-none pointer-events-none z-0">
                                        {boxNum}
                                    </span>

                                    {isDead ? (
                                        <div className="text-xl opacity-30 select-none grayscale">🚫</div>
                                    ) : (
                                        <>
                                            {(isConfirmed || isPending) ? (
                                                <div className="flex items-center justify-center w-full h-full">
                                                    {sq.emoji ? (
                                                        <span className="text-lg md:text-2xl drop-shadow-sm transition-transform group-hover:scale-125">{sq.emoji}</span>
                                                    ) : (
                                                        <span className="text-[10px] md:text-xs px-1 break-words leading-tight">{sq.display_name?.split(' ')[0]}</span>
                                                    )}
                                                </div>
                                            ) : null}

                                            {/* Tooltip for Names (Only if not available) */}
                                            {(!isAvailable) && (
                                                <div className="opacity-0 group-hover:opacity-100 absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 text-white text-[10px] rounded whitespace-nowrap pointer-events-none transition-opacity">
                                                    {sq.display_name}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
      </div>

      {/* Payment Links Section */}
      {(paymentLinks.length > 0 || paymentNotes || contactEmail) && (
        <div className="w-full max-w-3xl mx-auto mt-8 p-6 bg-slate-800 rounded-xl text-center shadow-lg border border-slate-700 print:hidden">
          <h3 className="text-xl font-bold text-white mb-2">Still need to confirm your spot?</h3>
          <p className="text-slate-400 text-sm mb-4">If you reserved a square but haven't paid yet, use the options below.</p>
          {paymentLinks.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              {paymentLinks.map(link => (
                <a
                  key={`${link.label}-${link.url}`}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className={getPaymentButtonClasses(link.style)}
                >
                  Pay with {link.label}
                </a>
              ))}
            </div>
          )}
          {paymentNotes && (
            <p className="text-slate-300 text-sm mt-4">{paymentNotes}</p>
          )}
          {contactEmail && (
            <p className="text-slate-400 text-xs mt-2">
              Questions? Email <a href={`mailto:${contactEmail}`} className="text-slate-200 underline">{contactEmail}</a>
            </p>
          )}
        </div>
      )}

      {/* Reservation Modal */}
      {selectedSquare && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border-t-4 border-blue-500 animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-['Russo_One'] mb-4 text-slate-800 uppercase">Reserve Square</h2>
            <form onSubmit={handleReserve}>
              <div className="mb-4">
                <label className="block text-xs font-bold mb-1 text-slate-600 uppercase">Display Name</label>
                <input 
                  type="text" 
                  required
                  placeholder='e.g. "The Smiths"'
                  className="w-full border-2 border-slate-200 rounded p-2 focus:border-blue-500 outline-none transition"
                  value={form.displayName}
                  onChange={e => setForm({...form, displayName: e.target.value})}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-xs font-bold mb-1 text-slate-600 uppercase">Lucky Icon</label>
                <div className="flex gap-2">
                    <input 
                    type="text" 
                    placeholder="🏈"
                    className="w-16 border-2 border-slate-200 rounded p-2 focus:border-blue-500 outline-none transition text-center text-2xl"
                    value={form.emoji}
                    onChange={e => setForm({...form, emoji: e.target.value})}
                    />
                     <div className="flex-1 overflow-x-auto whitespace-nowrap py-1 scrollbar-hide">
                        {PRESET_EMOJIS.map(em => (
                            <button
                                key={em}
                                type="button"
                                onClick={() => setForm({...form, emoji: em})}
                                className="inline-block text-2xl hover:scale-125 transition-transform mx-1 cursor-pointer"
                            >
                                {em}
                            </button>
                        ))}
                     </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-bold mb-1 text-slate-600 uppercase">Mobile Number</label>
                <input 
                  type="tel" 
                  required
                  placeholder="(555) 555-5555"
                  className="w-full border-2 border-slate-200 rounded p-2 focus:border-blue-500 outline-none transition"
                  value={form.contactInfo}
                  onChange={e => setForm({...form, contactInfo: e.target.value})}
                />
                <p className="text-[10px] text-gray-400 mt-1">For confirmation text only. Kept private.</p>
              </div>
              
              <div className="flex gap-2 justify-end pt-2 border-t">
                <button 
                  type="button" 
                  onClick={() => setSelectedSquare(null)}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded font-bold text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded shadow-lg hover:bg-blue-700 disabled:opacity-50 font-bold text-sm transform active:scale-95 transition"
                >
                  {isSubmitting ? 'Saving...' : 'Reserve Spot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successSquare && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center border-t-4 border-green-500">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner">✓</div>
            <h2 className="text-2xl font-['Russo_One'] mb-2 text-slate-800">Available!</h2>
            <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                {paymentLinks.length > 0 ? (
                  <>To confirm your spot, please pay <span className="font-bold text-green-700">{costText}</span> using one of the options below.</>
                ) : (
                  <>To confirm your spot, please contact the organizer for payment details.</>
                )}
            </p>
            {paymentNotes && (
              <p className="text-xs text-slate-500 italic mb-4">{paymentNotes}</p>
            )}
            
            {paymentLinks.length > 0 && (
              <div className="space-y-3 mb-6">
                {paymentLinks.map(link => (
                  <a
                    key={`${link.label}-${link.url}-modal`}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`${getPaymentButtonClasses(link.style)} w-full`}
                  >
                    Pay with {link.label}
                  </a>
                ))}
              </div>
            )}

            {contactEmail && (
              <p className="text-xs text-gray-400 mb-4">
                  Questions? Email us at <a href={`mailto:${contactEmail}`} className="text-gray-600 hover:text-black hover:underline">{contactEmail}</a>
              </p>
            )}

            <button 
              onClick={() => setSuccessSquare(null)}
              className="text-slate-400 text-sm hover:text-slate-600 font-bold uppercase tracking-wider"
            >
               Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
