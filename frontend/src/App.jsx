import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Grid from './components/Grid';
import AdminPanel from './components/AdminPanel';

function App() {
  const [showRules, setShowRules] = useState(false);
  const [config, setConfig] = useState({
    title: 'Super Bowl Pool',
    cost: '20',
    currency: '$',
    beneficiary: 'the Fundraiser',
    rules: {},
    payments: { links: [], notes: '' },
    contactEmail: ''
  });
  const rules = config.rules || {};
  const hasStructuredRules = !!(rules.draw || rules.payouts || rules.fundSplit);

  useEffect(() => {
    axios.get('api.php?action=config')
         .then(res => setConfig(res.data))
         .catch(err => console.error("Could not load config", err));
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-slate-900 text-gray-900 font-sans">
        <header className="bg-slate-900 text-white p-4 sticky top-0 z-50 border-b border-slate-800 print:hidden">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <h1 className="text-xl md:text-2xl font-['Russo_One'] tracking-wider flex items-center gap-2 text-yellow-500 print:text-black">
              <span>🏈</span> {config.title}
            </h1>
            <nav className="text-sm flex gap-4 items-center print:hidden">
              <button onClick={() => setShowRules(true)} className="hover:text-yellow-400 text-slate-300 font-bold uppercase tracking-wider transition">
                Rules & Prizes
              </button>
              <button onClick={() => window.print()} className="hover:text-yellow-400 text-slate-300 font-bold uppercase tracking-wider transition">
                Print
              </button>
              <Link to="/" className="hover:text-yellow-400 text-slate-300 font-bold uppercase tracking-wider transition">Grid</Link>
              <Link to="/admin" className="hover:text-yellow-400 text-slate-300 font-bold uppercase tracking-wider transition">Admin</Link>
            </nav>
          </div>
        </header>

        <main className="w-full">
          <Routes>
            <Route path="/" element={<Grid config={config} />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </main>

        {/* Rules Modal */}
        {showRules && (
          <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto" onClick={() => setShowRules(false)}>
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg relative my-8" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowRules(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
                
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">🏈 How It Works</h2>
                <div className="space-y-3 mb-6 text-sm text-gray-700">
                    <p><span className="font-bold">Cost:</span> {config.currency}{config.cost} per square.</p>
                    
                    {hasStructuredRules ? (
                      <>
                        <p><span className="font-bold">The Draw:</span> {rules.draw}</p>
                        {rules.randomness && (
                          <p><span className="font-bold">Randomness:</span> {rules.randomness}</p>
                        )}
                        <p><span className="font-bold">The Pot:</span> {rules.pot}</p>
                        {Array.isArray(rules.fundSplit) && rules.fundSplit.length > 0 && (
                          <ul className="list-disc pl-5">
                          {rules.fundSplit.map((line, idx) => (
                            <li key={idx}>{line}</li>
                          ))}
                          </ul>
                        )}

                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 mt-6">🏆 The Payouts</h2>
                        <div className="space-y-3 text-sm text-gray-700">
                          <p>{rules.payoutIntro || 'The Prize Pool is split across the four quarters. If your numbers match the score:'}</p>
                          <ul className="space-y-1">
                            <li><b>1st Quarter:</b> {rules.payouts?.q1 || '12.5% of Prize Pool'}</li>
                            <li><b>Halftime:</b> {rules.payouts?.half || '25% of Prize Pool'}</li>
                            <li><b>3rd Quarter:</b> {rules.payouts?.q3 || '12.5% of Prize Pool'}</li>
                            <li><b>Final Score:</b> {rules.payouts?.final || '50% of Prize Pool'}</li>
                          </ul>
                          <div className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-400 mt-4">
                            <p className="font-bold text-yellow-800 mb-1">⚠️ {rules.deadSquareTitle || 'The "Dead Square" Rule'}</p>
                            <p>{rules.deadSquareText || 'If the winning square for a quarter was not purchased, that prize money will be donated to the fundraiser.'}</p>
                          </div>
                        </div>
                      </>
                    ) : Object.keys(config.rules || {}).length > 0 ? (
                      Object.entries(config.rules).map(([key, val]) => (
                        <div key={key}>
                          <span className="font-bold">{key}:</span> <span dangerouslySetInnerHTML={{__html: val}} />
                        </div>
                      ))
                    ) : (
                        <>
                            <p><span className="font-bold">The Draw:</span> We will lock the pool on the Saturday before the Super Bowl (or when sold out). Once locked, the system will randomly assign numbers 0-9 to the rows and columns.</p>
                          <p><span className="font-bold">Randomness:</span> Numbers are generated with a secure random shuffle at lock time.</p>
                            <p><span className="font-bold">The Pot:</span> The Total Pot is calculated based on the number of squares sold.</p>
                            <ul className="list-disc pl-5">
                            <li><b>50%</b> goes directly to {config.beneficiary}.</li>
                            <li><b>50%</b> goes into the Prize Pool for the winners.</li>
                            </ul>

                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 mt-6">🏆 The Payouts</h2>
                            <div className="space-y-3 text-sm text-gray-700">
                                <p>The Prize Pool is split across the four quarters. If your numbers match the score:</p>
                                <ul className="space-y-1">
                                    <li><b>1st Quarter:</b> 12.5% of Prize Pool</li>
                                    <li><b>Halftime:</b> 25% of Prize Pool</li>
                                    <li><b>3rd Quarter:</b> 12.5% of Prize Pool</li>
                                    <li><b>Final Score:</b> 50% of Prize Pool</li>
                                </ul>
                                <div className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-400 mt-4">
                                    <p className="font-bold text-yellow-800 mb-1">⚠️ The "Dead Square" Rule</p>
                                    <p>If the winning square for a quarter was not purchased, that prize money will be donated to {config.beneficiary}.</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>
                
                <div className="mt-6 text-center">
                    <button onClick={() => setShowRules(false)} className="bg-slate-900 text-white px-6 py-2 rounded-full font-bold hover:bg-slate-700 transition">Got it!</button>
              </div>
                </div>
            </div>
          </div>
        )}
      </div>
    </Router>
  );
}

export default App;
