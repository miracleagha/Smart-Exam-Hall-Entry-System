import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { resolveMediaUrl } from '../../services/api';
import { QrCode, LayoutDashboard, History, User, LogOut, BookOpen } from 'lucide-react';

export const StudentLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-4 h-4" /> },
    { name: 'My QR Code', path: '/my-qr', icon: <QrCode className="w-4 h-4" /> },
    { name: 'Available Exams', path: '/available-exams', icon: <BookOpen className="w-4 h-4" /> },
    { name: 'Exam History', path: '/exam-history', icon: <History className="w-4 h-4" /> },
    { name: 'Profile', path: '/profile', icon: <User className="w-4 h-4" /> },
  ];

  const passportUrl = resolveMediaUrl(user?.passportPhoto);

  return (
    <div className="min-h-screen bg-geo-dots flex flex-col">
      {/* Dynamic Geometric Decorative Accents */}
      <div className="geo-shape-circle w-96 h-96 -top-24 -left-24 opacity-15" />
      <div className="geo-shape-circle w-64 h-64 top-1/3 -right-16 opacity-10 bg-flatBlue" />
      <div className="geo-shape-triangle bottom-12 right-12 opacity-15 rotate-12" />

      {/* Top Navigation Bar */}
      <header className="bg-white border-b-4 border-black sticky top-0 z-50 px-6 py-4 flex items-center justify-between gap-4 max-w-7xl mx-auto w-full mt-4 flat-border">
        {/* Brand */}
        <div className="flex items-center gap-2 select-none">
          <QrCode className="w-6 h-6 text-flatBlue stroke-[3]" />
          <span className="font-black text-xl uppercase tracking-wider text-black">SmartEntry</span>
          <span className="flat-border-sm bg-flatAmber text-black px-2 py-0.5 text-[10px] font-black uppercase">
            STUDENT
          </span>
        </div>

        {/* Links */}
        <nav className="hidden md:flex items-center gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 font-black uppercase text-xs tracking-wider border-2 border-transparent transition-all hover:scale-105 ${
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

        {/* User Actions */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-2">
            {passportUrl && (
              <img
                src={passportUrl}
                alt="Avatar"
                className="w-8 h-8 rounded-none border-2 border-black object-cover"
              />
            )}
            <span className="font-extrabold text-xs text-black uppercase">{user?.firstName}</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-3 py-2 border-2 border-black bg-white hover:bg-red-500 hover:text-white text-black font-black uppercase text-[10px] tracking-widest transition-all hover:scale-105 cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Header */}
      <nav className="md:hidden bg-white border-b-4 border-black px-4 py-2 grid grid-cols-5 gap-1 max-w-7xl mx-auto w-full flat-border border-t-0">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-2 font-black uppercase text-[9px] border-2 border-transparent transition-all ${
                isActive
                  ? 'bg-black text-white border-black'
                  : 'text-black hover:bg-gray-100 hover:border-black'
              }`
            }
          >
            {item.icon}
            <span className="mt-1">{item.name.split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>

      {/* Dynamic Content Pane */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-0 py-8 relative z-10 flex flex-col">
        <Outlet />
      </main>

      {/* Flat Footer */}
      <footer className="bg-white border-t-4 border-black py-6 text-center max-w-7xl mx-auto w-full flat-border mt-auto mb-4">
        <p className="font-extrabold text-xs uppercase text-gray-500 tracking-wider">
          © 2026 Smart Exam Entry Verification System. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default StudentLayout;
