import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  QrCode, 
  ScanLine, 
  CalendarCheck, 
  FileBarChart2, 
  History, 
  Settings, 
  LogOut,
  X
} from 'lucide-react';

export const Sidebar = ({ mobileOpen, setMobileOpen }) => {
  const { logout, user } = useAuth();

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'Students', path: '/students', icon: <Users className="w-5 h-5" /> },
    { name: 'Exams', path: '/exams', icon: <BookOpen className="w-5 h-5" /> },
    { name: 'QR Registry', path: '/qr-management', icon: <QrCode className="w-5 h-5" /> },
    { name: 'QR Scanner', path: '/scanner', icon: <ScanLine className="w-5 h-5" /> },
    { name: 'Attendance', path: '/attendance', icon: <CalendarCheck className="w-5 h-5" /> },
    { name: 'Reports', path: '/reports', icon: <FileBarChart2 className="w-5 h-5" /> },
    { name: 'Audit Logs', path: '/audit-logs', icon: <History className="w-5 h-5" /> },
    { name: 'Settings', path: '/settings', icon: <Settings className="w-5 h-5" /> }
  ];

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col shrink-0 border-r-4 border-black min-h-screen transition-transform duration-300 md:relative md:translate-x-0 ${
      mobileOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      {/* Brand Header */}
      <div className="p-6 border-b-4 border-black bg-flatBlue text-white select-none">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-black uppercase tracking-wider m-0 text-white flex items-center gap-2">
            <QrCode className="w-6 h-6 stroke-[3]" />
            SmartEntry
          </h1>
          <button 
            onClick={() => setMobileOpen(false)}
            className="md:hidden flat-border-sm p-1 bg-white text-black hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs font-bold mt-1 text-blue-100">INSTITUTION PORTAL</p>
      </div>

      {/* User Card */}
      <div className="p-4 border-b-4 border-black bg-gray-50 flex flex-col gap-1">
        <h4 className="font-black text-sm uppercase truncate text-black">{user?.name}</h4>
        <p className="text-xs font-bold text-gray-500 truncate">{user?.email}</p>
      </div>

      {/* Menu Navigation */}
      <nav className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => 
              `flex items-center gap-3 px-4 py-3 font-bold transition-all border-2 border-transparent uppercase text-sm tracking-wide hover:scale-102 ${
                isActive 
                  ? 'bg-black text-white border-black' 
                  : 'text-black hover:bg-gray-100 hover:border-black'
              }`
            }
          >
            {item.icon}
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 border-t-4 border-black bg-gray-50">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-black bg-white hover:bg-red-500 hover:text-white text-black font-extrabold uppercase text-sm tracking-wider transition-all hover:scale-102 active:scale-98 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
