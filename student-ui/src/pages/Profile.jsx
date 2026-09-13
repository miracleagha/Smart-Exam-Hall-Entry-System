import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { resolveMediaUrl } from '../services/api';
import { User, Lock, ArrowRight, Info } from 'lucide-react';

export const Profile = () => {
  const { user, updateProfile } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('info');

  // profile editor states
  const [profileForm, setProfileForm] = useState({
    phone: user?.phone || '',
    email: user?.email || '',
  });

  const [submitting, setSubmitting] = useState(false);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateProfile({
        phone: profileForm.phone,
        email: profileForm.email,
      });
      showToast('Profile updated successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Profile update failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const tabs = [
    { id: 'info', name: 'Student Profile', icon: <User className="w-4 h-4" /> },
    { id: 'password', name: 'Change Password', icon: <Lock className="w-4 h-4" /> },
  ];

  const passportUrl = resolveMediaUrl(user?.passportPhoto);

  return (
    <div className="space-y-8 select-none">
      {/* Title */}
      <div className="flex items-center justify-between gap-4 border-b-4 border-black pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-black m-0 tracking-wide">My Profile</h1>
          <p className="text-sm font-bold text-gray-500 uppercase mt-1">
            View your personal details and update your contact information.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Side: Navigation Tabs */}
        <div className="lg:col-span-1 flex flex-col gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-3 px-4 py-3 text-left font-black uppercase text-xs tracking-wider border-2 transition-all hover:scale-102 cursor-pointer ${
                activeTab === t.id
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-transparent hover:border-black'
              }`}
            >
              {t.icon}
              <span>{t.name}</span>
            </button>
          ))}
        </div>

        {/* Right Side: Tab Panel Contents */}
        <div className="lg:col-span-3 flat-card bg-white">
          {/* PROFILE INFO TAB */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black uppercase border-b-4 border-black pb-3 text-black">
                Personal Information
              </h2>

              <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-6 pb-6 border-b-2 border-dashed border-gray-300">
                {/* Photo (view-only) */}
                <div className="shrink-0">
                  {passportUrl ? (
                    <img
                      src={passportUrl}
                      alt="Student Profile"
                      className="w-24 h-24 border-4 border-black object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 border-4 border-black bg-gray-100 flex items-center justify-center">
                      <User className="w-10 h-10 text-gray-400" />
                    </div>
                  )}
                </div>

                <div className="space-y-1 text-center md:text-left font-semibold text-xs text-gray-600 flex-1">
                  <h3 className="text-xl font-black text-black uppercase">
                    {user?.lastName}, {user?.firstName}
                  </h3>
                  <div className="flex justify-center md:justify-start gap-1 mt-1">
                    <span className="flat-badge bg-gray-50 text-[10px] py-0.5 px-2 border-black font-black uppercase">
                      MATRIC: {user?.matricNumber}
                    </span>
                  </div>
                  <p className="pt-2">
                    USERNAME:{' '}
                    <span className="font-extrabold text-black uppercase">{user?.username}</span>
                  </p>
                  <p>
                    DEPARTMENT:{' '}
                    <span className="font-extrabold text-black uppercase">{user?.department}</span>
                  </p>
                  <p>
                    FACULTY:{' '}
                    <span className="font-extrabold text-black uppercase">{user?.faculty}</span>
                  </p>
                  <p>
                    ACADEMIC LEVEL:{' '}
                    <span className="font-extrabold text-black uppercase">{user?.level}</span>
                  </p>
                </div>
              </div>

              {/* Photo is managed by institution — surface this so students don't hunt for an upload button. */}
              <div className="flat-border bg-blue-50 border-black p-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-flatBlue shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-gray-700 uppercase leading-snug">
                  Your passport photo is managed by your institution. If it needs to be updated,
                  please contact your institution admin.
                </p>
              </div>

              {/* Contact editor */}
              <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-xl">
                <h4 className="font-black text-xs uppercase text-black">
                  Update Contact Information
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                      Email
                    </label>
                    <input
                      type="email"
                      className="flat-input text-sm py-2"
                      value={profileForm.email}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, email: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                      Phone
                    </label>
                    <input
                      type="text"
                      className="flat-input text-sm py-2"
                      value={profileForm.phone}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, phone: e.target.value })
                      }
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flat-btn-blue text-xs font-black py-3 px-6 uppercase mt-2 inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : 'Update Contact Details'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* PASSWORD TAB */}
          {activeTab === 'password' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black uppercase border-b-4 border-black pb-3 text-black">
                Change Password
              </h2>

              <div className="flat-border bg-blue-50 border-black p-4 text-left mb-4">
                <h4 className="font-black text-xs uppercase text-black mb-1">Password Reset</h4>
                <p className="text-[10px] font-bold text-gray-500 leading-snug uppercase">
                  For security, password changes are handled via the forgot password flow. Click
                  the button below to initiate a password reset via your registered email.
                </p>
              </div>

              <a
                href="/forgot-password"
                className="flat-btn-blue text-xs font-black py-3 px-6 uppercase inline-flex items-center gap-2"
              >
                Go to Password Reset
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
