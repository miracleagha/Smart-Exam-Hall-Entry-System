import React, { useEffect, useMemo, useState } from 'react';
import { api, resolveMediaUrl } from '../services/api';
import { useToast } from '../context/ToastContext';
import { QrCode, RefreshCw, Search, User, ScanLine, ShieldCheck, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * QR Registry
 *
 * In the new flow, students generate their own identity QR codes from the
 * student portal. Institution admins don't mint QRs — they just scan them.
 *
 * This page gives admins a read-only view of all active student QRs so they
 * can sanity-check that students have set theirs up.
 */
export const QRManagement = () => {
  const { showToast } = useToast();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchRows = async () => {
    setLoading(true);
    try {
      const data = await api.qrCodes.listIdentityQRs();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message || 'Failed to load QR registry.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const s = r.studentId || {};
      return (
        s.firstName?.toLowerCase().includes(q) ||
        s.lastName?.toLowerCase().includes(q) ||
        s.matricNumber?.toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  return (
    <div className="space-y-8 select-none">
      {/* Title */}
      <div className="flex items-center justify-between gap-4 border-b-4 border-black pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-black m-0 tracking-wide">QR Registry</h1>
          <p className="text-sm font-bold text-gray-500 uppercase mt-1">
            Read-only view of every active student identity QR. Students generate and manage their own codes.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchRows}
            className="flat-btn bg-white hover:scale-102 flex items-center gap-2 py-2.5 px-4 text-xs font-black uppercase cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <Link
            to="/scanner"
            className="flat-btn bg-flatBlue text-white hover:scale-102 flex items-center gap-2 py-2.5 px-4 text-xs font-black uppercase"
          >
            <ScanLine className="w-4 h-4" />
            Open Scanner
          </Link>
        </div>
      </div>

      {/* Info banner */}
      <div className="flat-card bg-blue-50 border-black p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-flatBlue shrink-0 mt-0.5" />
        <div>
          <h4 className="font-black text-xs uppercase text-black mb-1">New QR Flow</h4>
          <p className="text-[11px] font-bold text-gray-700 leading-snug">
            Each student's QR is minted on their own device via the Student portal and can be downloaded as a printable PDF pass. Your job here is simply to scan it at the exam hall — attendance is recorded automatically when the scanner has an exam selected.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flat-card bg-white">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-black">
            <Search className="w-5 h-5 stroke-[2.5]" />
          </div>
          <input
            type="text"
            placeholder="Search by name or matric number..."
            className="flat-input pl-11 py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flat-card bg-white p-12 text-center border-black">
          <div className="w-10 h-10 border-4 border-t-flatBlue border-black rounded-full animate-spin mx-auto mb-4" />
          <p className="font-extrabold text-sm uppercase text-gray-500">Loading QR registry...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flat-card bg-white p-12 text-center border-black">
          <QrCode className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-black uppercase text-black">No active QR codes</h3>
          <p className="text-xs font-bold text-gray-500 uppercase mt-1">
            Students will appear here after they generate their first identity QR from the Student portal.
          </p>
        </div>
      ) : (
        <div className="flat-card bg-white p-0 border-black overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-black text-white uppercase text-xs tracking-wider border-b-4 border-black">
                <th className="p-4 font-black">Student</th>
                <th className="p-4 font-black">Matric</th>
                <th className="p-4 font-black">Dept / Level</th>
                <th className="p-4 font-black">Issued</th>
                <th className="p-4 font-black">Expires</th>
                <th className="p-4 font-black">Last Scanned</th>
                <th className="p-4 font-black">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black">
              {filtered.map((qr) => {
                const student = qr.studentId || {};
                const photo = resolveMediaUrl(student.passportPhoto);
                return (
                  <tr key={qr._id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {photo ? (
                          <img
                            src={photo}
                            alt="Student"
                            className="w-10 h-10 border-2 border-black object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 border-2 border-black bg-gray-100 flex items-center justify-center shrink-0">
                            <User className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div className="font-black text-sm text-black leading-tight">
                          {student.lastName}, {student.firstName}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-black text-sm text-flatBlue">
                      {student.matricNumber || '—'}
                    </td>
                    <td className="p-4 font-bold text-xs uppercase text-gray-700">
                      <div>{student.department || '—'}</div>
                      <div className="text-[10px] text-gray-500">{student.level || ''}</div>
                    </td>
                    <td className="p-4 font-mono text-[11px] text-gray-700">
                      {qr.createdAt ? new Date(qr.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-4 font-mono text-[11px] text-gray-700">
                      {qr.expiresAt ? new Date(qr.expiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-4 font-mono text-[11px] text-gray-700 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-gray-400" />
                      {qr.usedAt ? new Date(qr.usedAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="p-4">
                      <span
                        className={`flat-badge border-2 text-[10px] font-black py-0.5 px-2.5 uppercase ${
                          qr.status === 'active'
                            ? 'bg-flatEmerald text-white'
                            : 'bg-gray-300 text-black'
                        }`}
                      >
                        {qr.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default QRManagement;
