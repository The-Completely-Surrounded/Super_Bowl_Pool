import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TEAMS, QUARTERS } from '../constants';

export default function AdminPanel() {
  const defaultRules = {
    draw: 'We will lock the pool on the Saturday before the Super Bowl (or when sold out). Once locked, numbers are assigned randomly to the rows and columns.',
    randomness: 'Numbers are generated with a secure random shuffle at lock time.',
    pot: 'The Total Pot is calculated based on the number of squares sold.',
    fundSplit: [
      '50% goes directly to the fundraiser.',
      '50% goes into the Prize Pool for the winners.'
    ],
    payoutIntro: 'The Prize Pool is split across the four quarters. If your numbers match the score:',
    payouts: {
      q1: '12.5% of Prize Pool',
      half: '25% of Prize Pool',
      q3: '12.5% of Prize Pool',
      final: '50% of Prize Pool'
    },
    deadSquareTitle: 'The "Dead Square" Rule',
    deadSquareText: 'If the winning square for a quarter was not purchased, that prize money will be donated to the fundraiser.'
  };

  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [squares, setSquares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({ nfcName: 'NFC', afcName: 'AFC' });
  const [scores, setScores] = useState({ q1: {n: '', a: ''}, half: {n: '', a: ''}, q3: {n: '', a: ''}, final: {n: '', a: ''} });
  const [editingSquare, setEditingSquare] = useState(null);
  const [rulesDraft, setRulesDraft] = useState(defaultRules);
  const [allowedTeamsInput, setAllowedTeamsInput] = useState('');

  const login = async (e) => {
    e.preventDefault();
    setLoading(true);
    fetchData(password);
  };

  const fetchData = async (pwd) => {
    try {
      const res = await axios.get('api.php?action=admin/data', {
        headers: { Authorization: `Bearer ${pwd}` }
      });
      setSquares(res.data.squares);
      setSettings(res.data.settings || { nfcName: 'NFC', afcName: 'AFC' });
      const incomingRules = res.data.settings?.rules || {};
      setRulesDraft({
        ...defaultRules,
        ...incomingRules,
        fundSplit: incomingRules.fundSplit || defaultRules.fundSplit,
        payouts: { ...defaultRules.payouts, ...(incomingRules.payouts || {}) }
      });
      const allowedTeams = res.data.settings?.allowedTeams || [];
      setAllowedTeamsInput(Array.isArray(allowedTeams) ? allowedTeams.join(', ') : '');
      setIsAuthenticated(true);
    } catch (error) {
        if (!isAuthenticated) {
            console.error(error);
            alert(`Login Failed: ${error.response?.status} - ${error.response?.data?.error || error.message}`);
        }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
        await axios.post('api.php?action=admin/edit-square', 
            { 
               id: editingSquare.id, 
               display_name: editingSquare.display_name, 
               emoji: editingSquare.emoji 
            },
            { headers: { Authorization: `Bearer ${password}` } }
        );
        alert('Updated successfully');
        setEditingSquare(null);
        fetchData(password);
    } catch (error) {
        console.error(error);
        alert('Update failed');
    }
  };

  const normalizePhone = (value) => {
    if (!value) return '';
    const digits = String(value).replace(/[^0-9+]/g, '');
    return digits;
  };

  const buildSmsLink = (square, statusLabel) => {
    const phone = normalizePhone(square?.contact_info);
    if (!phone) return '';
    const row = square?.row_index ?? '?';
    const col = square?.col_index ?? '?';
    const squareNumber = Number.isInteger(row) && Number.isInteger(col) ? (row * 10 + col + 1) : '?';
    const name = square?.display_name || 'there';
    const emoji = square?.emoji ? `${square.emoji} ` : '';
    const message = `Hi ${emoji}${name}! Your square #${squareNumber} is ${statusLabel}. Payment received. Thanks!`;
    return `sms:${phone}?&body=${encodeURIComponent(message)}`;
  };

  const buildWinnerSummary = () => {
    const winners = settings?.winners || {};
    const labels = { q1: 'Q1', half: 'Halftime', q3: 'Q3', final: 'Final' };
    return Object.entries(labels)
      .map(([key, label]) => `${label}: ${winners[key] || 'TBD'}`)
      .join(' | ');
  };

  const buildWinnerSmsLink = (square, wonLabels) => {
    const phone = normalizePhone(square?.contact_info);
    if (!phone) return '';
    const name = square?.display_name || 'there';
    const emoji = square?.emoji ? `${square.emoji} ` : '';
    const wonText = wonLabels?.length ? `You won ${wonLabels.join(', ')}! ` : '';
    const winnerSummary = buildWinnerSummary();
    const message = `Hi ${emoji}${name}! ${wonText}Thanks for playing. Winners: ${winnerSummary}`;
    return `sms:${phone}?&body=${encodeURIComponent(message)}`;
  };

  const getWinnerSquares = () => {
    const winners = settings?.winners || {};
    const labels = { q1: 'Q1', half: 'Halftime', q3: 'Q3', final: 'Final' };
    const winnerNames = Object.entries(labels)
      .filter(([key]) => winners[key])
      .map(([key, label]) => ({ name: winners[key], label }));

    const matches = new Map();
    confirmedSquares.forEach(sq => {
      const matchedLabels = winnerNames
        .filter(w => w.name === sq.display_name)
        .map(w => w.label);
      if (matchedLabels.length > 0) {
        matches.set(sq.id, { square: sq, labels: matchedLabels });
      }
    });
    return Array.from(matches.values());
  };

  const openSmsLinksForSquares = (squaresList, linkBuilder) => {
    const links = squaresList
      .map(linkBuilder)
      .filter(link => link);
    if (links.length === 0) {
      alert('No valid phone numbers found.');
      return;
    }
    if (!window.confirm(`Open ${links.length} text messages? Your browser may block popups.`)) return;
    links.forEach(link => window.open(link, '_blank'));
  };

  const parseAllowedTeams = () => {
    return allowedTeamsInput
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  };

  const getTeamOptions = () => {
    const allowed = parseAllowedTeams();
    const allTeams = Object.keys(TEAMS);
    if (allowed.length === 0) return allTeams;
    return allowed.filter(name => allTeams.includes(name));
  };

  const maybeTextSquare = (square, statusLabel) => {
    const smsLink = buildSmsLink(square, statusLabel);
    if (!smsLink) return;
    if (window.confirm('Send a confirmation text now?')) {
      window.open(smsLink, '_blank');
    }
  };

  const handleAction = async (square, status, askToText = false) => {
    if (!window.confirm(`Are you sure you want to ${status === 'available' ? 'REJECT' : 'CONFIRM'} this square?`)) return;
    
    try {
      const formData = new URLSearchParams({
        id: String(square.id),
        status: String(status),
        row_index: String(square.row_index),
        col_index: String(square.col_index)
      });
      await axios.post('api.php?action=admin/update-status', formData, {
        headers: {
          Authorization: `Bearer ${password}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      if (status === 'confirmed' && askToText) {
        maybeTextSquare(square, 'confirmed');
      }
      fetchData(password);
    } catch (error) {
      alert(error.response?.data?.error || 'Action failed');
    }
  };

  const handleUpdateSettings = async () => {
    try {
        const allowedTeams = parseAllowedTeams();
        await axios.post('api.php?action=admin/settings', {
            nfcName: settings.nfcName,
            afcName: settings.afcName,
            allowedTeams
        }, {
            headers: { Authorization: `Bearer ${password}` }
        });
        alert('Team Names Saved!');
    } catch (error) {
        alert(error.response?.data?.error || 'Failed to save settings');
    }
  };

  const handleSaveRules = async () => {
    try {
      await axios.post('api.php?action=admin/settings', {
        rules: rulesDraft
      }, {
        headers: { Authorization: `Bearer ${password}` }
      });
      alert('Rules Saved!');
      fetchData(password);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to save rules');
    }
  };

  const handleToggleLock = async () => {
    const isLocked = settings.locked;
    const actionName = isLocked ? "UNLOCK" : "LOCK";
    const msg = isLocked 
        ? "Warning: UNLOCKING will RESET numbers to '?' and allow reservations again. Proceed?"
        : "Warning: LOCKING will STOP new reservations and ROLL random numbers. Proceed?";

    if (!window.confirm(msg)) return;
    
    try {
      await axios.post('api.php?action=admin/toggle-lock', { locked: !isLocked }, { headers: { Authorization: `Bearer ${password}` } });
      alert(`Pool ${isLocked ? 'Unlocked' : 'Locked'}!`);
      fetchData(password);
    } catch (error) {
      alert('Action failed');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex justify-center mt-20">
        <form onSubmit={login} className="bg-white p-6 rounded shadow-lg">
          <h2 className="text-lg font-bold mb-4">Admin Login</h2>
          <input 
            type="password" 
            className="border p-2 rounded w-full mb-4" 
            placeholder="Admin Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button type="submit" className="w-full bg-blue-900 text-white p-2 rounded">Login</button>
        </form>
      </div>
    );
  }

  const pendingSquares = squares.filter(s => s.status === 'pending');
  const confirmedSquares = squares.filter(s => s.status === 'confirmed');

  // Finances
  const totalRaised = confirmedSquares.length * 20;
  const ptaShare = totalRaised * 0.5;
  const prizePool = totalRaised * 0.5;

  return (
    <div className="bg-white p-4 md:p-6 rounded shadow-lg text-sm">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <div className="flex gap-2">
            <button onClick={() => fetchData(password)} className="bg-gray-100 px-3 py-1 rounded hover:bg-gray-200">Refresh</button>
        </div>
      </div>

       {/* Financial Overview */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800 text-white p-4 rounded shadow">
            <div className="text-xs uppercase text-slate-400 font-bold">Total Raised</div>
            <div className="text-2xl font-bold">${totalRaised}</div>
            <div className="text-xs text-slate-400">{confirmedSquares.length} Squares Sold</div>
        </div>
        <div className="bg-emerald-600 text-white p-4 rounded shadow">
            <div className="text-xs uppercase text-emerald-100 font-bold">Fund Share (50%)</div>
            <div className="text-2xl font-bold">${ptaShare.toFixed(2)}</div>
        </div>
        <div className="bg-blue-600 text-white p-4 rounded shadow">
            <div className="text-xs uppercase text-blue-100 font-bold">Prize Pool (50%)</div>
            <div className="text-2xl font-bold">${prizePool.toFixed(2)}</div>
            <div className="mt-2 pt-2 border-t border-blue-500 text-xs flex justify-between gap-2 overflow-x-auto">
                <span title="Q1 & Q3">Q1/Q3: ${(prizePool * 0.125).toFixed(0)}</span>
                <span title="Halftime">Half: ${(prizePool * 0.25).toFixed(0)}</span>
                <span title="Final">Final: ${(prizePool * 0.50).toFixed(0)}</span>
            </div>
        </div>
      </div>

       {/* Game Controls */}
       <div className="bg-blue-50 p-4 rounded border border-blue-200 mb-6">
        <h3 className="text-lg font-bold mb-3 text-blue-900">Game Configuration</h3>
        <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-blue-800 uppercase mb-1">Row Team (Left / AFC)</label>
            <input
              list="team-options"
              className="w-full border rounded p-2"
              value={settings.afcName}
              onChange={e => setSettings({...settings, afcName: e.target.value})}
              placeholder="AFC"
            />
            </div>
            <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-blue-800 uppercase mb-1">Col Team (Top / NFC)</label>
            <input
              list="team-options"
              className="w-full border rounded p-2"
              value={settings.nfcName}
              onChange={e => setSettings({...settings, nfcName: e.target.value})}
              placeholder="NFC"
            />
            </div>
          <datalist id="team-options">
            {getTeamOptions().map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </datalist>
            <button 
                onClick={handleUpdateSettings}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-bold"
            >
                Save Teams
            </button>
             <div className="w-[1px] h-10 bg-blue-200 mx-2 hidden md:block"></div>
            <button 
                onClick={handleToggleLock}
                className={`px-4 py-2 rounded font-bold whitespace-nowrap text-white ${settings.locked ? 'bg-orange-500 hover:bg-orange-600' : 'bg-purple-600 hover:bg-purple-700'}`}
            >
                {settings.locked ? '🔓 UNLOCK & RESET' : '🎲 LOCK & ROLL'}
            </button>
        </div>
        <div className="w-full mt-4">
          <label className="block text-xs font-bold text-blue-800 uppercase mb-1">Allowed Teams (comma-separated)</label>
          <input
            className="w-full border rounded p-2"
            value={allowedTeamsInput}
            onChange={e => setAllowedTeamsInput(e.target.value)}
            placeholder="Leave blank to allow all teams"
          />
          <p className="text-xs text-blue-700 mt-1">Example: Chiefs, Eagles, Bills</p>
        </div>
        </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pending List */}
        <div>
          <h3 className="text-lg font-bold mb-3 text-yellow-600 border-b pb-2">Pending ({pendingSquares.length})</h3>
          {pendingSquares.length === 0 && <p className="text-gray-400 italic">No pending reservations.</p>}
          <ul className="space-y-4">
            {pendingSquares.map(sq => (
              <li key={sq.id} className="bg-yellow-50 p-3 rounded border border-yellow-100 flex flex-col gap-1">
                <div className="font-bold">{sq.display_name}</div>
                <div className="text-gray-600">📱 {sq.contact_info}</div>
                <div className="text-xs text-gray-400">Row: {sq.row_index}, Col: {sq.col_index}</div>
                <div className="flex gap-2 mt-2">
                  <button 
                    onClick={() => handleAction(sq, 'confirmed', true)}
                    className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 flex-1"
                  >
                    Confirm Paid
                  </button>
                  <button 
                    onClick={() => handleAction(sq, 'available')}
                    className="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600 flex-1"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Confirmed List */}
        <div>
          <h3 className="text-lg font-bold mb-3 text-green-600 border-b pb-2">Confirmed ({confirmedSquares.length})</h3>
          {confirmedSquares.length === 0 && <p className="text-gray-400 italic">No confirmed reservations.</p>}
          <div className="bg-white border rounded">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="p-2">Name</th>
                  <th className="p-2">Sq</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {confirmedSquares.map(sq => (
                  <tr key={sq.id} className="border-t">
                    <td className="p-2">
                        <div className="font-medium">{sq.emoji} {sq.display_name}</div>
                        <div className="text-xs text-gray-400">{sq.contact_info}</div>
                    </td>
                    <td className="p-2 text-xs text-gray-500">
                        {sq.row_index},{sq.col_index}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <button 
                            onClick={() => setEditingSquare(sq)}
                            className="text-blue-500 hover:text-blue-700 text-xs underline"
                        >
                            Edit
                        </button>
                        <button 
                          onClick={() => handleAction(sq, 'available')}
                            className="text-red-400 hover:text-red-600 text-xs underline"
                        >
                            Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
          
          {/* Winners / Auto-Scoring Section */}
          <div className="bg-white p-6 rounded-lg shadow mb-8 mt-8 border-t-4 border-purple-500">
            <h2 className="text-xl font-bold mb-4 text-purple-900">Game Scorer (Auto-Calc)</h2>
            <div className="flex flex-col md:flex-row gap-3 mb-6">
              <button
                onClick={() => {
                  const winnersList = getWinnerSquares();
                  const winnerSquares = winnersList.map(item => item.square);
                  openSmsLinksForSquares(winnerSquares, (sq) => {
                    const labels = winnersList.find(item => item.square.id === sq.id)?.labels || [];
                    return buildWinnerSmsLink(sq, labels);
                  });
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded font-bold hover:bg-purple-700"
              >
                Text Winners Only
              </button>
              <button
                onClick={() => openSmsLinksForSquares(confirmedSquares, (sq) => buildWinnerSmsLink(sq, []))}
                className="bg-slate-600 text-white px-4 py-2 rounded font-bold hover:bg-slate-700"
              >
                Thank You + Winners (All Confirmed)
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {QUARTERS.map((q) => (
                    <div key={q.key} className="bg-slate-50 p-4 rounded border">
                        <label className="block text-sm font-bold mb-2 uppercase text-gray-700 border-b pb-1">{q.label}</label>
                        
                        <div className="flex gap-2 mb-2">
                             <input 
                                type="number"
                                placeholder="NFC"
                                className="w-1/2 border p-2 rounded text-center"
                                value={scores[q.key].n}
                                onChange={(e) => setScores({...scores, [q.key]: {...scores[q.key], n: e.target.value}})}
                            />
                            <input 
                                type="number"
                                placeholder="AFC"
                                className="w-1/2 border p-2 rounded text-center"
                                value={scores[q.key].a}
                                onChange={(e) => setScores({...scores, [q.key]: {...scores[q.key], a: e.target.value}})}
                            />
                        </div>

                        <button 
                            onClick={async () => {
                                if(!scores[q.key].n || !scores[q.key].a) return alert('Enter both scores!');
                                try {
                                    const res = await axios.post('api.php?action=admin/calculate-winner', 
                                        { quarter: q.key, nfcScore: scores[q.key].n, afcScore: scores[q.key].a },
                                        { headers: { Authorization: `Bearer ${password}` } }
                                    );
                                    alert(`Winner Found: ${res.data.winner}`);
                                    fetchData(password); // Refresh
                                } catch(e) {
                                    alert(e.response?.data?.error || 'Calc Failed');
                                }
                            }}
                            className="w-full bg-blue-600 text-white text-sm py-1 rounded hover:bg-blue-700"
                        >
                            Calc & Save
                        </button>

                        <div className="mt-2 text-xs text-gray-400 truncate">
                            Currently: <span className="text-gray-600 font-medium">{settings?.winners?.[q.key] || 'TBD'}</span>
                        </div>
                    </div>
                ))}
            </div>
          </div>

          {/* Rules & Prizes */}
          <div className="bg-slate-50 p-4 rounded border border-slate-200 mb-6">
            <h3 className="text-lg font-bold mb-3 text-slate-800">Rules & Prizes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">The Draw</label>
                <textarea
                  className="w-full border rounded p-2"
                  rows="2"
                  value={rulesDraft.draw}
                  onChange={e => setRulesDraft({ ...rulesDraft, draw: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Randomness</label>
                <textarea
                  className="w-full border rounded p-2"
                  rows="2"
                  value={rulesDraft.randomness}
                  onChange={e => setRulesDraft({ ...rulesDraft, randomness: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">The Pot</label>
                <textarea
                  className="w-full border rounded p-2"
                  rows="2"
                  value={rulesDraft.pot}
                  onChange={e => setRulesDraft({ ...rulesDraft, pot: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Fund Split Line 1</label>
                <textarea
                  className="w-full border rounded p-2"
                  rows="2"
                  value={rulesDraft.fundSplit?.[0] || ''}
                  onChange={e => setRulesDraft({ ...rulesDraft, fundSplit: [e.target.value, rulesDraft.fundSplit?.[1] || ''] })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Fund Split Line 2</label>
                <textarea
                  className="w-full border rounded p-2"
                  rows="2"
                  value={rulesDraft.fundSplit?.[1] || ''}
                  onChange={e => setRulesDraft({ ...rulesDraft, fundSplit: [rulesDraft.fundSplit?.[0] || '', e.target.value] })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payout Intro</label>
                <textarea
                  className="w-full border rounded p-2"
                  rows="2"
                  value={rulesDraft.payoutIntro}
                  onChange={e => setRulesDraft({ ...rulesDraft, payoutIntro: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Q1 Payout</label>
                <input
                  className="w-full border rounded p-2"
                  value={rulesDraft.payouts?.q1 || ''}
                  onChange={e => setRulesDraft({ ...rulesDraft, payouts: { ...rulesDraft.payouts, q1: e.target.value } })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Halftime Payout</label>
                <input
                  className="w-full border rounded p-2"
                  value={rulesDraft.payouts?.half || ''}
                  onChange={e => setRulesDraft({ ...rulesDraft, payouts: { ...rulesDraft.payouts, half: e.target.value } })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Q3 Payout</label>
                <input
                  className="w-full border rounded p-2"
                  value={rulesDraft.payouts?.q3 || ''}
                  onChange={e => setRulesDraft({ ...rulesDraft, payouts: { ...rulesDraft.payouts, q3: e.target.value } })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Final Payout</label>
                <input
                  className="w-full border rounded p-2"
                  value={rulesDraft.payouts?.final || ''}
                  onChange={e => setRulesDraft({ ...rulesDraft, payouts: { ...rulesDraft.payouts, final: e.target.value } })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Dead Square Title</label>
                <input
                  className="w-full border rounded p-2"
                  value={rulesDraft.deadSquareTitle}
                  onChange={e => setRulesDraft({ ...rulesDraft, deadSquareTitle: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Dead Square Text</label>
                <textarea
                  className="w-full border rounded p-2"
                  rows="2"
                  value={rulesDraft.deadSquareText}
                  onChange={e => setRulesDraft({ ...rulesDraft, deadSquareText: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={handleSaveRules}
                className="bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-900 font-bold"
              >
                Save Rules
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="mt-12 p-6 border-2 border-red-200 bg-red-50 rounded-lg">
                <h3 className="text-red-700 font-bold mb-4">Danger Zone</h3>
                
                <div className="flex flex-col md:flex-row gap-4">
                     <button 
                        onClick={async () => {
                            if(window.confirm("Confirm: Clear ALL 'Yellow' Pending Squares? Paid (Green) squares will be safe.")) {
                                try {
                                    await axios.post('api.php?action=admin/clear-pending', {}, { headers: { Authorization: `Bearer ${password}` } });
                                    alert("Pending squares cleared.");
                                    fetchData(password);
                                } catch(e) { alert("Failed to clear pending"); }
                            }
                        }}
                        className="bg-orange-500 text-white px-6 py-3 rounded font-bold hover:bg-orange-600 flex-1"
                    >
                        🧹 Clear All Pending
                    </button>

                    <button 
                        onClick={async () => {
                            if(window.confirm("ARE YOU SURE? This will DELETE ALL reservations and reset the grid numbers. This cannot be undone.")) {
                                try {
                                    await axios.post('api.php?action=admin/reset', {}, { headers: { Authorization: `Bearer ${password}` } });
                                    alert("Game Reset Complete.");
                                    fetchData(password);
                                } catch(e) { alert("Reset Failed"); }
                            }
                        }}
                        className="bg-red-600 text-white px-6 py-3 rounded font-bold hover:bg-red-700 flex-1"
                    >
                        ⚠️ GLOBAL RESET GAME
                    </button>
                </div>
          </div>

      {/* Edit Modal */}
      {editingSquare && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4">Edit Square</h3>
                <form onSubmit={handleSaveEdit}>
                    <div className="mb-4">
                        <label className="block text-sm font-bold mb-2">Display Name</label>
                        <input 
                            className="w-full border p-2 rounded"
                            value={editingSquare.display_name}
                            onChange={e => setEditingSquare({...editingSquare, display_name: e.target.value})}
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-bold mb-2">Emoji</label>
                        <input 
                            className="w-full border p-2 rounded"
                            value={editingSquare.emoji || ''}
                            onChange={e => setEditingSquare({...editingSquare, emoji: e.target.value})}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button 
                            type="button"
                            onClick={() => setEditingSquare(null)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
}
