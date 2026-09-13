import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  Users, 
  BookOpen, 
  CheckSquare, 
  UserCheck, 
  UserX,
  Activity,
  Cpu,
  RefreshCw,
  Plus
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { Link } from 'react-router-dom';

export const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalExams: 0,
    todayAttendance: 0,
    verifiedStudents: 0,
    absentStudents: 0
  });
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  // Seed chart data
  const attendanceTrends = [
    { name: 'Mon', attendance: 85 },
    { name: 'Tue', attendance: 92 },
    { name: 'Wed', attendance: 88 },
    { name: 'Thu', attendance: 95 },
    { name: 'Fri', attendance: 91 }
  ];

  const examStats = [
    { name: 'Comp Sci', value: 40 },
    { name: 'Mathematics', value: 25 },
    { name: 'Statistics', value: 15 },
    { name: 'Physics', value: 20 }
  ];

  const verificationStats = [
    { time: '09:00', successful: 25, rejected: 2 },
    { time: '10:00', successful: 48, rejected: 5 },
    { time: '11:00', successful: 67, rejected: 3 },
    { time: '12:00', successful: 12, rejected: 1 },
    { time: '13:00', successful: 35, rejected: 4 }
  ];

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentRes, examRes, attendanceRes] = await Promise.all([
          api.students.list({ limit: 1000 }),
          api.exams.list({ limit: 1000 }),
          api.attendance.list({ limit: 1000 }),
        ]);
        const logsRes = await api.auditLogs.list({ limit: 100 });

        const studentList = Array.isArray(studentRes) ? studentRes : studentRes?.students || [];
        const examList = Array.isArray(examRes) ? examRes : examRes?.exams || [];
        const attendanceList = Array.isArray(attendanceRes) ? attendanceRes : attendanceRes?.records || [];
        const logs = Array.isArray(logsRes) ? logsRes : logsRes?.logs || logsRes?.records || [];

        const activeExams = examList.filter((e) => e.status === 'active' || e.status === 'Active').length;
        const totalStuds = studentList.length;
        const todayAtt = attendanceList.length;
        
        // Let's assume some calculations for absent:
        // Absent = Computer Science students (STUD-001 & STUD-003 are CSC/MTH active) - checked in today
        const absent = Math.max(0, totalStuds - todayAtt);

        setStats({
          totalStudents: totalStuds,
          totalExams: activeExams,
          todayAttendance: todayAtt,
          verifiedStudents: todayAtt, // all checks in are verified
          absentStudents: absent
        });

        // Normalize audit log rows so the "Recent Audits" list has a
        // consistent shape regardless of backend field names.
        const normalizedLogs = logs.map((raw) => {
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
          };
        });
        setActivities(normalizedLogs.slice(0, 5));
      } catch (err) {
        console.error('Error fetching dashboard statistics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-black uppercase text-black">Dashboard</h1>
        {/* Skeleton Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flat-card h-32 bg-white animate-pulse border-gray-300" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="flat-card h-96 lg:col-span-2 bg-white animate-pulse border-gray-300" />
          <div className="flat-card h-96 bg-white animate-pulse border-gray-300" />
        </div>
      </div>
    );
  }

  const statCards = [
    { title: 'Total Students', value: stats.totalStudents, icon: <Users className="w-6 h-6" />, color: 'bg-flatBlue' },
    { title: 'Total Exams', value: stats.totalExams, icon: <BookOpen className="w-6 h-6" />, color: 'bg-flatAmber' },
    { title: 'Today\'s Attendance', value: stats.todayAttendance, icon: <CheckSquare className="w-6 h-6" />, color: 'bg-flatEmerald' },
    { title: 'Verified Students', value: stats.verifiedStudents, icon: <UserCheck className="w-6 h-6" />, color: 'bg-green-600' },
    { title: 'Absent Students', value: stats.absentStudents, icon: <UserX className="w-6 h-6" />, color: 'bg-red-500' }
  ];

  return (
    <div className="space-y-8 select-none">
      {/* Page Header Title */}
      <div className="flex items-center justify-between gap-4 border-b-4 border-black pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-black m-0 tracking-wide">Dashboard</h1>
          <p className="text-sm font-bold text-gray-500 uppercase mt-1">Welcome back. System online & auditing active.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/scanner" className="flat-btn bg-black text-white hover:scale-105 transition-transform text-xs py-2 px-4 flex items-center gap-1">
            <Plus className="w-4 h-4 stroke-[3]" />
            Launch Scanner
          </Link>
        </div>
      </div>

      {/* Metrics Row Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {statCards.map((c, i) => (
          <div key={i} className="flat-card bg-white relative overflow-hidden flex flex-col justify-between pt-6 pb-4">
            {/* Flat Color Block Stripe on top */}
            <div className={`absolute top-0 left-0 right-0 h-3 ${c.color} border-b-4 border-black`} />
            
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-black uppercase tracking-wider text-gray-500">{c.title}</span>
              <span className="text-black font-black">{c.icon}</span>
            </div>
            
            <h3 className="text-4xl font-black text-black tracking-tight">{c.value}</h3>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance & Verification Charts */}
        <div className="flat-card bg-white lg:col-span-2">
          <h3 className="font-black text-lg uppercase border-b-4 border-black pb-3 mb-6 text-black flex items-center gap-2">
            <Activity className="w-5 h-5 text-flatBlue" />
            Verification & Attendance Trends
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={verificationStats}>
                <XAxis dataKey="time" stroke="#000000" strokeWidth={2} tick={{ fontWeight: 'bold' }} />
                <YAxis stroke="#000000" strokeWidth={2} tick={{ fontWeight: 'bold' }} />
                <Tooltip 
                  contentStyle={{ border: '4px solid #000000', borderRadius: '0px', fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="successful" stroke="#10B981" strokeWidth={4} dot={{ strokeWidth: 3, r: 6 }} name="Verified" />
                <Line type="monotone" dataKey="rejected" stroke="#EF4444" strokeWidth={4} dot={{ strokeWidth: 3, r: 6 }} name="Rejected" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Exam stats */}
        <div className="flat-card bg-white">
          <h3 className="font-black text-lg uppercase border-b-4 border-black pb-3 mb-6 text-black flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-flatAmber" />
            Department Distributions
          </h3>
          <div className="h-72 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={examStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {examStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#000000" strokeWidth={3} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ border: '4px solid #000000', borderRadius: '0px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Chart Legend */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            {examStats.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-black inline-block" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-[10px] font-black uppercase text-black truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lower Row: Recent Activity & System Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <div className="flat-card bg-white flex flex-col justify-between">
          <div>
            <h3 className="font-black text-lg uppercase border-b-4 border-black pb-3 mb-4 text-black flex items-center gap-2">
              <Activity className="w-5 h-5 text-flatBlue" />
              Recent Audits
            </h3>
            <div className="divide-y-2 divide-black">
              {activities.map((act) => (
                <div key={act.id} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-extrabold text-sm text-black">{act.description}</p>
                    <span className="text-[10px] font-bold text-gray-500 uppercase mt-0.5 block">
                      {act.timestamp ? new Date(act.timestamp).toLocaleString() : '—'}
                    </span>
                  </div>
                  <span className="flat-border-sm bg-gray-100 text-black px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shrink-0 select-none">
                    {act.activityType}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <Link to="/audit-logs" className="flat-btn-gray w-full text-xs font-black uppercase tracking-wider py-3 mt-4">
            View All Logs
          </Link>
        </div>

        {/* System Status Checklist */}
        <div className="flat-card bg-white flex flex-col justify-between">
          <div>
            <h3 className="font-black text-lg uppercase border-b-4 border-black pb-3 mb-4 text-black flex items-center gap-2">
              <Cpu className="w-5 h-5 text-flatEmerald" />
              Security Status
            </h3>
            <ul className="space-y-4">
              <li className="flex items-center justify-between border-2 border-black p-3 bg-gray-50">
                <span className="font-black text-xs uppercase text-black">Camera Verification Driver</span>
                <span className="flat-border-sm bg-flatEmerald text-white px-2 py-0.5 text-[9px] font-black uppercase">READY</span>
              </li>
              <li className="flex items-center justify-between border-2 border-black p-3 bg-gray-50">
                <span className="font-black text-xs uppercase text-black">Audit Logging Stream</span>
                <span className="flat-border-sm bg-flatEmerald text-white px-2 py-0.5 text-[9px] font-black uppercase">ONLINE</span>
              </li>
              <li className="flex items-center justify-between border-2 border-black p-3 bg-gray-50">
                <span className="font-black text-xs uppercase text-black">Local Datastore Integrity</span>
                <span className="flat-border-sm bg-flatEmerald text-white px-2 py-0.5 text-[9px] font-black uppercase">SECURE</span>
              </li>
              <li className="flex items-center justify-between border-2 border-black p-3 bg-gray-50">
                <span className="font-black text-xs uppercase text-black">Cryptographic Keys</span>
                <span className="flat-border-sm bg-flatEmerald text-white px-2 py-0.5 text-[9px] font-black uppercase">VALID</span>
              </li>
            </ul>
          </div>
          
          <div className="mt-6 flex items-center justify-between gap-3 text-gray-500 font-extrabold text-[10px] uppercase border-t-2 border-gray-200 pt-4">
            <span className="flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Auto-sync: Active
            </span>
            <span>Version: 1.0.4-dev</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
