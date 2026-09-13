import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { 
  FileText, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  Layers,
  ArrowRight,
  TrendingUp,
  XCircle,
  CheckCircle,
  FileMinus
} from 'lucide-react';

export const Reports = () => {
  const { showToast } = useToast();
  
  const [reportType, setReportType] = useState('attendance');
  const [filterCourse, setFilterCourse] = useState('');
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentList, examList, attList, auditList] = await Promise.all([
          api.students.list({ limit: 1000 }),
          api.exams.list({ limit: 1000 }),
          api.attendance.list({ limit: 1000 }),
          api.auditLogs.list({ limit: 1000 }),
        ]);

        setStudents(Array.isArray(studentList) ? studentList : studentList?.students || []);
        setExams(Array.isArray(examList) ? examList : examList?.exams || []);
        setAttendance(Array.isArray(attList) ? attList : attList?.records || []);
        setLogs(Array.isArray(auditList) ? auditList : auditList?.logs || auditList?.records || []);
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  }, []);

  const handleGenerateReport = () => {
    setLoading(true);
    setTimeout(() => {
      let filtered = [];
      if (reportType === 'attendance') {
        filtered = attendance.filter(
          r => filterCourse ? r.courseCode.toLowerCase() === filterCourse.toLowerCase() : true
        );
      } else if (reportType === 'exams') {
        filtered = exams;
      } else if (reportType === 'verification') {
        // filter audit logs relating to qr verifications
        filtered = logs.filter(l => l.activityType === 'QR Verification');
      } else if (reportType === 'students') {
        filtered = students;
      }
      
      setPreviewData(filtered);
      setGenerated(true);
      setLoading(false);
      showToast(`${reportType.toUpperCase()} Report generated successfully!`, 'success');
    }, 600);
  };

  const getCsvContent = () => {
    if (reportType === 'attendance') {
      let csv = 'Matric,Student Name,Course Code,Time Verified,Venue\n';
      previewData.forEach(r => {
        csv += `"${r.matricNumber}","${r.studentName}","${r.courseCode}","${r.timeVerified}","${r.venue}"\n`;
      });
      return csv;
    } else if (reportType === 'exams') {
      let csv = 'Course Code,Course Title,Date,Time,Venue,Dept\n';
      previewData.forEach(e => {
        csv += `"${e.courseCode}","${e.courseTitle}","${e.examDate}","${e.examTime}","${e.venue}","${e.department}"\n`;
      });
      return csv;
    } else if (reportType === 'verification') {
      let csv = 'Log ID,Timestamp,Activity,Operator\n';
      previewData.forEach(l => {
        csv += `"${l.id}","${l.timestamp}","${l.description}","${l.userId}"\n`;
      });
      return csv;
    } else {
      let csv = 'Matric,Name,Department,Level,Email,Status\n';
      previewData.forEach(s => {
        csv += `"${s.matricNumber}","${s.lastName}, ${s.firstName}","${s.department}","${s.level}","${s.email}","${s.status}"\n`;
      });
      return csv;
    }
  };

  const triggerDownload = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    const csvContent = getCsvContent();
    triggerDownload(csvContent, `${reportType}_report.csv`, 'text/csv;charset=utf-8;');
    showToast('CSV export downloaded', 'success');
  };

  const handleExportExcel = () => {
    const csvContent = getCsvContent();
    // Simply swap commas for tabs
    const xlsContent = csvContent.replace(/,/g, '\t');
    triggerDownload(xlsContent, `${reportType}_report.xls`, 'application/vnd.ms-excel;charset=utf-8;');
    showToast('Excel export downloaded', 'success');
  };

  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank');
    let rowsHTML = '';
    
    if (reportType === 'attendance') {
      previewData.forEach(r => {
        rowsHTML += `<tr><td>${r.matricNumber}</td><td>${r.studentName}</td><td>${r.courseCode}</td><td>${new Date(r.timeVerified).toLocaleTimeString()}</td><td>${r.venue}</td></tr>`;
      });
    } else if (reportType === 'exams') {
      previewData.forEach(e => {
        rowsHTML += `<tr><td>${e.courseCode}</td><td>${e.courseTitle}</td><td>${e.examDate}</td><td>${e.examTime}</td><td>${e.venue}</td></tr>`;
      });
    } else if (reportType === 'verification') {
      previewData.forEach(l => {
        rowsHTML += `<tr><td>${l.id}</td><td>${new Date(l.timestamp).toLocaleString()}</td><td>${l.description}</td><td>${l.userId}</td></tr>`;
      });
    } else {
      previewData.forEach(s => {
        rowsHTML += `<tr><td>${s.matricNumber}</td><td>${s.lastName}, ${s.firstName}</td><td>${s.department}</td><td>${s.level}</td><td>${s.status}</td></tr>`;
      });
    }

    const headers = {
      attendance: '<th>Matric Number</th><th>Student Name</th><th>Course</th><th>Time</th><th>Venue</th>',
      exams: '<th>Code</th><th>Title</th><th>Date</th><th>Time</th><th>Venue</th>',
      verification: '<th>Log ID</th><th>Timestamp</th><th>Description</th><th>Scanner/Operator</th>',
      students: '<th>Matric Number</th><th>Name</th><th>Department</th><th>Level</th><th>Status</th>'
    };

    printWindow.document.write(`
      <html>
        <head>
          <title>${reportType.toUpperCase()} REPORT</title>
          <style>
            body { font-family: monospace; padding: 30px; }
            h1 { text-align: center; border-bottom: 4px solid #000; padding-bottom: 10px; margin: 0 0 20px 0; uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 2px solid #000; padding: 10px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: 900; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <h1>SYSTEM AUDIT: ${reportType.toUpperCase()} REPORT</h1>
          <p>RUN DATE: ${new Date().toLocaleString()}</p>
          <p>TOTAL RECORDS RECORDED: ${previewData.length}</p>
          <table>
            <thead>
              <tr>${headers[reportType]}</tr>
            </thead>
            <tbody>
              ${rowsHTML}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    showToast('Print window triggered', 'success');
  };

  return (
    <div className="space-y-8 select-none">
      {/* Title */}
      <div className="flex items-center justify-between gap-4 border-b-4 border-black pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-black m-0 tracking-wide">Reports</h1>
          <p className="text-sm font-bold text-gray-500 uppercase mt-1">Compile attendance records, exam histories, and scanner activity audits.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Parameters Form */}
        <div className="flat-card bg-white space-y-6">
          <h3 className="font-black text-lg uppercase border-b-4 border-black pb-3 text-black flex items-center gap-1.5">
            <Layers className="w-5 h-5 text-flatBlue" />
            Report Parameters
          </h3>

          <div className="space-y-4">
            {/* Report Target */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">Report Category</label>
              <select
                className="flat-select text-xs py-2 bg-no-repeat"
                value={reportType}
                onChange={(e) => {
                  setReportType(e.target.value);
                  setGenerated(false);
                }}
              >
                <option value="attendance">Exam Attendance Reports</option>
                <option value="exams">Scheduled Exams Reports</option>
                <option value="verification">Verification Audits Reports</option>
                <option value="students">Student Registry Reports</option>
              </select>
            </div>

            {/* Sub-Filters depending on category */}
            {reportType === 'attendance' && (
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">Filter by Course Code</label>
                <select
                  className="flat-select text-xs py-2 bg-no-repeat"
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                >
                  <option value="">All Active Courses</option>
                  <option value="CSC 401">CSC 401</option>
                  <option value="CSC 403">CSC 403</option>
                  <option value="MTH 301">MTH 301</option>
                </select>
              </div>
            )}

            {/* Run Button */}
            <button
              onClick={handleGenerateReport}
              disabled={loading}
              className="w-full flat-btn-blue justify-center py-3 text-sm font-black mt-2"
            >
              {loading ? 'Compiling Datastores...' : 'Compile Report Pass'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Side: Preview & Download Actions */}
        <div className="lg:col-span-2 space-y-6">
          
          {generated ? (
            <div className="space-y-6">
              
              {/* Summary card */}
              <div className="flat-card bg-gray-50 border-black p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="space-y-1 text-center md:text-left">
                  <h3 className="text-xl font-black uppercase text-black">
                    {reportType} Report Compiled
                  </h3>
                  <p className="text-xs font-extrabold uppercase text-gray-500">
                    Audit size: {previewData.length} records matched. Ready for print payload extraction.
                  </p>
                </div>
                
                {/* Download controls */}
                <div className="grid grid-cols-3 gap-2 shrink-0 w-full md:w-auto">
                  <button
                    onClick={handleExportCSV}
                    className="flat-btn bg-white hover:scale-102 text-[10px] py-2 px-3 font-black uppercase flex flex-col items-center justify-center gap-1.5"
                    title="Export CSV"
                  >
                    <Download className="w-4 h-4 text-flatBlue" />
                    CSV
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="flat-btn bg-white hover:scale-102 text-[10px] py-2 px-3 font-black uppercase flex flex-col items-center justify-center gap-1.5"
                    title="Export Excel"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-flatEmerald" />
                    Excel
                  </button>
                  <button
                    onClick={handlePrintPDF}
                    className="flat-btn bg-black text-white hover:scale-102 text-[10px] py-2 px-3 font-black uppercase flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                    title="Print PDF"
                  >
                    <Printer className="w-4 h-4 text-white" />
                    Print
                  </button>
                </div>
              </div>

              {/* Data table preview */}
              <div className="flat-card bg-white p-0 border-black overflow-x-auto max-h-96">
                {previewData.length === 0 ? (
                  <div className="p-8 text-center">
                    <FileMinus className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="font-bold text-xs uppercase text-gray-500">No records found matching filters.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs font-semibold">
                    <thead>
                      <tr className="bg-black text-white uppercase text-[10px] tracking-wide border-b-2 border-black sticky top-0">
                        {reportType === 'attendance' && (
                          <>
                            <th className="p-3 font-black">Matric</th>
                            <th className="p-3 font-black">Name</th>
                            <th className="p-3 font-black">Course</th>
                            <th className="p-3 font-black">Time Verified</th>
                          </>
                        )}
                        {reportType === 'exams' && (
                          <>
                            <th className="p-3 font-black">Code</th>
                            <th className="p-3 font-black">Title</th>
                            <th className="p-3 font-black">Date</th>
                            <th className="p-3 font-black">Venue</th>
                          </>
                        )}
                        {reportType === 'verification' && (
                          <>
                            <th className="p-3 font-black">Log ID</th>
                            <th className="p-3 font-black">Timestamp</th>
                            <th className="p-3 font-black">Audit Detail</th>
                          </>
                        )}
                        {reportType === 'students' && (
                          <>
                            <th className="p-3 font-black">Matric</th>
                            <th className="p-3 font-black">Name</th>
                            <th className="p-3 font-black">Department</th>
                            <th className="p-3 font-black">Status</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black">
                      {previewData.map((row, idx) => (
                        <tr key={row.id || idx} className="hover:bg-gray-50 bg-white">
                          {reportType === 'attendance' && (
                            <>
                              <td className="p-3 font-black text-flatBlue">{row.matricNumber}</td>
                              <td className="p-3 font-black">{row.studentName}</td>
                              <td className="p-3">{row.courseCode}</td>
                              <td className="p-3 font-mono">{new Date(row.timeVerified).toLocaleTimeString()}</td>
                            </>
                          )}
                          {reportType === 'exams' && (
                            <>
                              <td className="p-3 font-black text-flatBlue">{row.courseCode}</td>
                              <td className="p-3 font-black">{row.courseTitle}</td>
                              <td className="p-3">{row.examDate}</td>
                              <td className="p-3">{row.venue}</td>
                            </>
                          )}
                          {reportType === 'verification' && (
                            <>
                              <td className="p-3 font-mono text-flatBlue">{row.id}</td>
                              <td className="p-3 font-mono">{new Date(row.timestamp).toLocaleTimeString()}</td>
                              <td className="p-3 font-black">{row.description}</td>
                            </>
                          )}
                          {reportType === 'students' && (
                            <>
                              <td className="p-3 font-black text-flatBlue">{row.matricNumber}</td>
                              <td className="p-3 font-black">{row.lastName}, {row.firstName}</td>
                              <td className="p-3">{row.department}</td>
                              <td className="p-3">
                                <span className={`flat-badge text-[9px] font-black border py-0.5 px-1.5 ${row.status === 'Active' ? 'bg-flatEmerald text-white' : 'bg-red-500 text-white'}`}>
                                  {row.status}
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="flat-card bg-white p-16 text-center border-black flex flex-col items-center justify-center h-full min-h-[300px]">
              <FileText className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-black uppercase text-black">Awaiting Generation</h3>
              <p className="text-xs font-bold text-gray-500 uppercase mt-1">Configure the report parameters and click Compile above to fetch results.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Reports;
