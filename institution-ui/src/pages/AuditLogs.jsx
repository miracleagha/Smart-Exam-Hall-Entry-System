import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { History, Search, Printer } from 'lucide-react';

/**
 * Normalize a backend AuditLog document to the flat shape this table expects.
 */
const normalizeLog = (raw) => {
  const details =
    raw?.details && typeof raw.details === 'object'
      ? Object.entries(raw.details)
          .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
          .join(', ')
      : '';
  return {
    id: raw._id || raw.id,
    activityType: raw.action || raw.activityType || 'ACTIVITY',
    description:
      raw.description ||
      [raw.resource, details].filter(Boolean).join(' • ') ||
      'System event',
    timestamp: raw.createdAt || raw.timestamp || null,
    userId: raw.userId ? String(raw.userId) : raw.userType || 'system',
  };
};

export const AuditLogs = () => {
  const { showToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.auditLogs.list({ limit: 500 });
      const rows = Array.isArray(data) ? data : data?.logs || data?.records || [];
      setLogs(rows.map(normalizeLog));
    } catch (err) {
      showToast(err.message || 'Failed to fetch audit logs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesSearch =
        !q ||
        log.description.toLowerCase().includes(q) ||
        log.userId.toLowerCase().includes(q) ||
        log.activityType.toLowerCase().includes(q);
      const matchesType = filterType
        ? log.activityType.toLowerCase() === filterType.toLowerCase()
        : true;
      return matchesSearch && matchesType;
    });
  }, [logs, searchQuery, filterType]);

  const activityTypes = useMemo(() => {
    const set = new Set(logs.map((l) => l.activityType).filter(Boolean));
    return Array.from(set).slice(0, 20);
  }, [logs]);

  const getBadgeColor = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('login')) return 'bg-flatBlue text-white';
    if (t.includes('student_created') || t.includes('exam_created')) return 'bg-flatEmerald text-white';
    if (t.includes('qr')) return 'bg-flatAmber text-black';
    if (t.includes('verified')) return 'bg-purple-600 text-white';
    if (t.includes('suspended') || t.includes('revoked')) return 'bg-red-500 text-white';
    return 'bg-gray-200 text-black';
  };

  const printLogs = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Please allow pop-ups to print.', 'warning');
      return;
    }
    let rowsHTML = '';
    filteredLogs.forEach((l) => {
      rowsHTML += `
        <tr>
          <td>${l.timestamp ? new Date(l.timestamp).toLocaleString() : '—'}</td>
          <td>${l.activityType}</td>
          <td>${l.description}</td>
          <td>${l.userId}</td>
        </tr>
      `;
    });

    printWindow.document.write(`
      <html>
        <head>
          <title>Audit Logs</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { border-bottom: 3px solid #000; padding-bottom: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 2px solid #000; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f2f2f2; }
          </style>
        </head>
        <body onload="window.print(); setTimeout(() => window.close(), 400);">
          <h1>Audit Logs</h1>
          <p>Generated: ${new Date().toLocaleString()} • ${filteredLogs.length} entries</p>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Activity</th>
                <th>Description</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-8 select-none">
      {/* Title */}
      <div className="flex items-center justify-between gap-4 border-b-4 border-black pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-black m-0 tracking-wide">Audit Logs</h1>
          <p className="text-sm font-bold text-gray-500 uppercase mt-1">
            All security-relevant events across your institution.
          </p>
        </div>
        <button
          onClick={printLogs}
          className="flat-btn bg-black text-white hover:scale-102 flex items-center gap-2 py-2.5 px-4 text-xs font-black uppercase cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
      </div>

      {/* Filters */}
      <div className="flat-card bg-white grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-black">
            <Search className="w-5 h-5 stroke-[2.5]" />
          </div>
          <input
            type="text"
            placeholder="Search description, actor, or activity..."
            className="flat-input pl-11 py-2 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="flat-select py-2 text-sm"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All activities</option>
          {activityTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flat-card bg-white p-12 text-center border-black">
          <div className="w-10 h-10 border-4 border-t-flatBlue border-black rounded-full animate-spin mx-auto mb-4" />
          <p className="font-extrabold text-sm uppercase text-gray-500">Loading logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="flat-card bg-white p-12 text-center border-black">
          <History className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-black uppercase text-black">No logs found</h3>
          <p className="text-xs font-bold text-gray-500 uppercase mt-1">
            Institution activity will appear here as it happens.
          </p>
        </div>
      ) : (
        <div className="flat-card bg-white p-0 border-black overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-black text-white uppercase text-xs tracking-wider border-b-4 border-black">
                <th className="p-4 font-black w-48">Timestamp</th>
                <th className="p-4 font-black w-56">Activity</th>
                <th className="p-4 font-black">Description</th>
                <th className="p-4 font-black w-48">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black text-xs font-semibold text-gray-700">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 bg-white">
                  <td className="p-4 font-mono text-flatBlue font-bold">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                  </td>
                  <td className="p-4">
                    <span
                      className={`flat-badge text-[10px] font-black border-2 py-0.5 px-2 ${getBadgeColor(log.activityType)}`}
                    >
                      {log.activityType}
                    </span>
                  </td>
                  <td className="p-4 font-black text-black text-sm">{log.description}</td>
                  <td className="p-4 font-mono font-bold text-gray-500 truncate max-w-[200px]">
                    {log.userId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
