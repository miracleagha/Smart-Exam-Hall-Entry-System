import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, resolveMediaUrl } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Link } from 'react-router-dom';
import { 
  User, 
  BookOpen, 
  QrCode, 
  CalendarCheck, 
  ArrowRight,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

export const Dashboard = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.dashboard.get();
        setDashboardData(data);
      } catch (err) {
        showToast('Failed to fetch dashboard resources', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeExams = dashboardData?.activeExams || [];
  const upcomingExams = dashboardData?.upcomingExams || [];
  const attendanceHistory = dashboardData?.attendanceHistory || [];
  const stats = dashboardData?.stats || {};

  // Find if there is an active exam today
  const todayStr = new Date().toISOString().split('T')[0];
  const todayExam = activeExams.find(e => {
    const examDateStr = e.examDate ? new Date(e.examDate).toISOString().split('T')[0] : '';
    return examDateStr === todayStr;
  }) || activeExams[0];

  const otherExams = [...activeExams, ...upcomingExams].filter(e => e._id !== todayExam?._id);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flat-card h-48 bg-white animate-pulse border-gray-300" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flat-card h-64 bg-white animate-pulse border-gray-300" />
          <div className="flat-card h-64 bg-white animate-pulse border-gray-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 select-none">
      
      {/* Student Profile Info Banner */}
      <div className="flat-card bg-white flex flex-col md:flex-row items-center md:items-start gap-6 border-black relative overflow-hidden">
        {/* Left Side Accent */}
        <div className="absolute left-0 top-0 bottom-0 w-3 bg-flatBlue border-r-4 border-black" />
        
        {resolveMediaUrl(user?.passportPhoto) && (
          <img
            src={resolveMediaUrl(user?.passportPhoto)}
            alt="Student Passport"
            className="w-28 h-28 border-4 border-black object-cover shrink-0 ml-4"
          />
        )}

        <div className="space-y-2 text-center md:text-left flex-1 pl-4 md:pl-0">
          <span className="flat-badge bg-flatBlue text-white text-[10px] font-black uppercase py-0.5 px-2 border-none">
            {user?.matricNumber}
          </span>
          <h2 className="text-2xl font-black text-black">
            Welcome, {user?.firstName} {user?.lastName}
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-bold text-gray-500 uppercase pt-2">
            <div>DEPT: <span className="text-black font-black">{user?.department}</span></div>
            <div>FACULTY: <span className="text-black font-black">{user?.faculty}</span></div>
            <div>LEVEL: <span className="text-black font-black">{user?.level}</span></div>
          </div>
        </div>
      </div>

      {/* Main Grid split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Today's Exam & Upcoming List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's active pass */}
          {todayExam ? (
            <div className="flat-card bg-flatAmber border-black p-6 relative overflow-hidden flex flex-col justify-between h-full min-h-[220px]">
              <div className="space-y-2">
                <span className="flat-border-sm bg-black text-white text-[10px] font-black uppercase py-0.5 px-2.5 flex items-center gap-1.5 w-max">
                  <AlertTriangle className="w-3.5 h-3.5 text-flatAmber" />
                  ACTIVE EXAM SCHEDULE
                </span>
                <h3 className="text-2xl font-black text-black mt-2 leading-none">
                  {todayExam.courseCode} - {todayExam.title}
                </h3>
                <p className="text-xs font-black uppercase text-gray-800 tracking-wider">
                  VENUE: {todayExam.venue} | TIME: {todayExam.startTime} - {todayExam.endTime}
                </p>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row items-center gap-4">
                <Link
                  to="/my-qr"
                  className="w-full sm:w-auto flat-btn bg-black text-white hover:scale-102 text-xs font-black py-3 px-6 flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  <QrCode className="w-5 h-5 stroke-[2.5]" />
                  Show My QR Code
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <span className="text-[10px] font-bold text-amber-950 uppercase leading-snug">
                  Present your QR code at the exam hall entrance for verification.
                </span>
              </div>
            </div>
          ) : (
            <div className="flat-card bg-white text-center py-12 border-black flex flex-col items-center">
              <ShieldCheck className="w-12 h-12 text-flatEmerald mb-2" />
              <h3 className="text-lg font-black uppercase text-black">No Active Exams Right Now</h3>
              <p className="text-xs font-bold text-gray-500 uppercase mt-1">Check the upcoming list below for your scheduled exams.</p>
            </div>
          )}

          {/* Upcoming list */}
          <div className="flat-card bg-white">
            <h3 className="font-black text-lg uppercase border-b-4 border-black pb-3 mb-6 text-black flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-flatBlue" />
              Upcoming Exam Sessions
            </h3>
            
            {otherExams.length === 0 ? (
              <p className="text-xs font-bold text-gray-400 text-center py-6 uppercase">No upcoming exams scheduled</p>
            ) : (
              <div className="divide-y-2 divide-black">
                {otherExams.map(exam => (
                  <div key={exam._id} className="py-4 flex justify-between items-center gap-4">
                    <div>
                      <span className="flat-badge bg-black text-white text-[9px] font-black uppercase py-0.5 px-2.5 border-none">
                        {exam.courseCode}
                      </span>
                      <h4 className="font-black text-sm text-black mt-1 uppercase">{exam.title}</h4>
                      <p className="text-[10px] font-bold text-gray-500 mt-0.5 uppercase">
                        Date: {new Date(exam.examDate).toLocaleDateString()} | Venue: {exam.venue}
                      </p>
                    </div>
                    <span className="flat-border-sm bg-gray-50 text-black font-black text-[10px] px-3 py-1 uppercase shrink-0">
                      {exam.startTime}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Attendance overview summary stats */}
        <div className="space-y-6">
          <div className="flat-card bg-white h-full flex flex-col justify-between">
            <div>
              <h3 className="font-black text-lg uppercase border-b-4 border-black pb-3 mb-4 text-black flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-flatEmerald" />
                Attendance Summary
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flat-border bg-gray-50 p-4 text-center">
                  <span className="text-[10px] font-black text-gray-500 uppercase">Exams Attended</span>
                  <h4 className="text-2xl font-black text-flatEmerald mt-1">{stats.totalExamsAttended || 0}</h4>
                </div>
                <div className="flat-border bg-gray-50 p-4 text-center">
                  <span className="text-[10px] font-black text-gray-500 uppercase">Total Records</span>
                  <h4 className="text-2xl font-black text-flatBlue mt-1">{stats.totalAttendanceRecords || 0}</h4>
                </div>
              </div>

              {/* Recent check ins */}
              <h4 className="font-black text-xs uppercase text-black mb-3">Recent Check-ins</h4>
              {attendanceHistory.length === 0 ? (
                <p className="text-[10px] font-bold text-gray-400 py-4 uppercase">No entry logs found</p>
              ) : (
                <div className="space-y-2">
                  {attendanceHistory.slice(0, 3).map(att => (
                    <div key={att._id} className="flat-border border-black p-3 bg-gray-50 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-black text-black uppercase">
                          {att.examId?.courseCode || 'N/A'}
                        </span>
                        <p className="text-[9px] font-bold text-gray-500 mt-0.5 uppercase">
                          Time: {att.verifiedAt ? new Date(att.verifiedAt).toLocaleTimeString() : 'N/A'}
                        </p>
                      </div>
                      <span className={`flat-badge text-white text-[9px] border-none px-2 py-0.5 ${
                        att.verificationStatus === 'verified' ? 'bg-flatEmerald' : 'bg-red-500'
                      }`}>
                        {att.verificationStatus === 'verified' ? 'Verified' : 'Rejected'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Link
              to="/exam-history"
              className="flat-btn-gray w-full text-xs font-black uppercase py-3 mt-6"
            >
              View Full History
            </Link>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default Dashboard;
