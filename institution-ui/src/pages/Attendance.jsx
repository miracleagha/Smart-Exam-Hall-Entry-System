import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  Search,
  Download,
  Printer,
  CalendarCheck,
  FileText,
} from 'lucide-react';

/**
 * Normalize a backend attendance record into the flat shape this page's
 * table + export helpers expect. Backend rows come populated with
 * studentId + examId sub-documents.
 */
const normalizeRecord = (raw) => {
  const student = raw?.studentId || {};
  const exam = raw?.examId || {};
  return {
    id: raw._id || raw.id,
    matricNumber: student.matricNumber || raw.matricNumber || '—',
    studentName:
      raw.studentName ||
      [student.firstName, student.lastName].filter(Boolean).join(' ') ||
      '—',
    courseCode: exam.courseCode || raw.courseCode || '—',
    courseTitle: exam.title || exam.courseTitle || raw.courseTitle || '—',
    timeVerified: raw.verifiedAt || raw.timeVerified || raw.createdAt || null,
    venue: exam.venue || raw.venue || '—',
    status: raw.verificationStatus || 'verified',
  };
};

export const Attendance = () => {
  const { showToast } = useToast();
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterVenue, setFilterVenue] = useState('');

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const data = await api.attendance.list({ limit: 500 });
      const rows = Array.isArray(data) ? data : data?.records || [];
      setAttendance(rows.map(normalizeRecord));
    } catch (err) {
      showToast(err.message || 'Failed to fetch attendance records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return attendance.filter((r) => {
      const matchesSearch =
        !q ||
        r.studentName.toLowerCase().includes(q) ||
        r.matricNumber.toLowerCase().includes(q) ||
        r.courseCode.toLowerCase().includes(q);
      const matchesCourse = filterCourse
        ? r.courseCode.toLowerCase() === filterCourse.toLowerCase()
        : true;
      const matchesVenue = filterVenue
        ? r.venue.toLowerCase() === filterVenue.toLowerCase()
        : true;
      return matchesSearch && matchesCourse && matchesVenue;
    });
  }, [attendance, searchQuery, filterCourse, filterVenue]);

  const courseOptions = useMemo(() => {
    const set = new Set(attendance.map((r) => r.courseCode).filter(Boolean));
    return Array.from(set);
  }, [attendance]);

  const venueOptions = useMemo(() => {
    const set = new Set(attendance.map((r) => r.venue).filter(Boolean));
    return Array.from(set);
  }, [attendance]);

  const exportCSV = () => {
    let csv = 'Matric,Student Name,Course Code,Course Title,Time Verified,Venue,Status\n';
    filteredRecords.forEach((r) => {
      csv += `"${r.matricNumber}","${r.studentName}","${r.courseCode}","${r.courseTitle}","${r.timeVerified || ''}","${r.venue}","${r.status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'attendance_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Attendance CSV downloaded.', 'success');
  };

  const printAttendance = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Please allow pop-ups to print.', 'warning');
      return;
    }
    let rowsHTML = '';
    filteredRecords.forEach((r, idx) => {
      rowsHTML += `
        <tr>
          <td>${idx + 1}</td>
          <td>${r.matricNumber}</td>
          <td>${r.studentName}</td>
          <td>${r.courseCode}</td>
          <td>${r.timeVerified ? new Date(r.timeVerified).toLocaleString() : '—'}</td>
          <td>${r.venue}</td>
        </tr>
      `;
    });

    printWindow.document.write(`
      <html>
        <head>
          <title>Attendance Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { border-bottom: 3px solid #000; padding-bottom: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 2px solid #000; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f2f2f2; }
          </style>
        </head>
        <body onload="window.print(); setTimeout(() => window.close(), 400);">
          <h1>Attendance Report</h1>
          <p>Generated: ${new Date().toLocaleString()} • ${filteredRecords.length} records</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Matric</th>
                <th>Student</th>
                <th>Course</th>
                <th>Time Verified</th>
                <th>Venue</th>
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
          <h1 className="text-3xl font-black uppercase text-black m-0 tracking-wide">Attendance</h1>
          <p className="text-sm font-bold text-gray-500 uppercase mt-1">
            All verified check-ins across every exam.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="flat-btn bg-white hover:scale-102 flex items-center gap-1.5 py-2 px-4 text-xs font-black uppercase cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={printAttendance}
            className="flat-btn bg-black text-white hover:scale-102 flex items-center gap-1.5 py-2 px-4 text-xs font-black uppercase cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flat-card bg-white grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-black">
            <Search className="w-5 h-5 stroke-[2.5]" />
          </div>
          <input
            type="text"
            placeholder="Search by name, matric, or course..."
            className="flat-input pl-11 py-2 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="flat-select py-2 text-sm"
          value={filterCourse}
          onChange={(e) => setFilterCourse(e.target.value)}
        >
          <option value="">All courses</option>
          {courseOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          className="flat-select py-2 text-sm"
          value={filterVenue}
          onChange={(e) => setFilterVenue(e.target.value)}
        >
          <option value="">All venues</option>
          {venueOptions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flat-card bg-white p-12 text-center border-black">
          <div className="w-10 h-10 border-4 border-t-flatBlue border-black rounded-full animate-spin mx-auto mb-4" />
          <p className="font-extrabold text-sm uppercase text-gray-500">Loading attendance...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="flat-card bg-white p-12 text-center border-black">
          <CalendarCheck className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-black uppercase text-black">No attendance records</h3>
          <p className="text-xs font-bold text-gray-500 uppercase mt-1">
            Records will show up here as students are scanned in.
          </p>
        </div>
      ) : (
        <div className="flat-card bg-white p-0 border-black overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-black text-white uppercase text-xs tracking-wider border-b-4 border-black">
                <th className="p-4 font-black">Matric</th>
                <th className="p-4 font-black">Student Name</th>
                <th className="p-4 font-black">Course</th>
                <th className="p-4 font-black">Time Verified</th>
                <th className="p-4 font-black">Venue</th>
                <th className="p-4 font-black">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black">
              {filteredRecords.map((rec) => (
                <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-black text-sm text-flatBlue">{rec.matricNumber}</td>
                  <td className="p-4 font-black text-sm text-black">{rec.studentName}</td>
                  <td className="p-4 font-bold text-xs uppercase text-gray-700">
                    {rec.courseCode} — {rec.courseTitle}
                  </td>
                  <td className="p-4 font-mono text-xs text-gray-600">
                    {rec.timeVerified ? new Date(rec.timeVerified).toLocaleString() : '—'}
                  </td>
                  <td className="p-4 font-extrabold text-xs text-black uppercase">{rec.venue}</td>
                  <td className="p-4">
                    <span
                      className={`flat-badge border-2 text-[10px] font-black py-0.5 px-2.5 uppercase ${
                        rec.status === 'verified'
                          ? 'bg-flatEmerald text-white'
                          : 'bg-red-500 text-white'
                      }`}
                    >
                      {rec.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flat-card bg-gray-50 border-black p-4 text-left">
        <h4 className="font-black text-xs uppercase text-black mb-1 flex items-center gap-1">
          <FileText className="w-4 h-4 text-flatBlue stroke-[3]" />
          About attendance records
        </h4>
        <p className="text-[10px] font-bold text-gray-500 leading-snug uppercase">
          Records are created automatically when a student's QR is scanned at the exam hall with an exam selected in the scanner.
        </p>
      </div>
    </div>
  );
};

export default Attendance;
