import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, resolveMediaUrl } from '../services/api';
import { User, Lock, ArrowRight, Info, Building2 } from 'lucide-react';

/**
 * Settings
 *
 * Institution profile management. Password changes go through the forgot
 * password flow (email link) to keep credential handling consistent with
 * the student portal.
 */
export const Settings = () => {
  const { user, institution } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('profile');

  const [profileForm, setProfileForm] = useState({
    name: institution?.name || '',
    phone: institution?.phone || '',
    address: institution?.address || '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Refresh institution info from the server on mount so the form reflects
    // whatever the backend actually has (localStorage may be stale).
    let cancelled = false;
    (async () => {
      try {
        const data = await api.institution.getProfile();
        if (cancelled || !data) return;
        setProfileForm({
          name: data.name || '',
          phone: data.phone || '',
          address: data.address || '',
        });
      } catch (_err) {
        // Non-fatal — the form still has the cached values from context.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.institution.updateProfile(profileForm);
      showToast('Institution profile updated.', 'success');
    } catch (err) {
      showToast(err.message || 'Profile update failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const tabs = [
    { id: 'profile', name: 'Institution Profile', icon: <User className="w-4 h-4" /> },
    { id: 'password', name: 'Change Password', icon: <Lock className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-8 select-none">
      {/* Title */}
      <div className="flex items-center justify-between gap-4 border-b-4 border-black pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-black m-0 tracking-wide">Settings</h1>
          <p className="text-sm font-bold text-gray-500 uppercase mt-1">
            Manage your institution's profile details.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left: tabs */}
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

        {/* Right: content */}
        <div className="lg:col-span-3 flat-card bg-white">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black uppercase border-b-4 border-black pb-3 text-black">
                Institution details
              </h2>

              <div className="flex items-center gap-4 pb-4 border-b-2 border-dashed border-gray-300">
                {resolveMediaUrl(institution?.logo) ? (
                  <img
                    src={resolveMediaUrl(institution?.logo)}
                    alt="Logo"
                    className="w-16 h-16 border-4 border-black object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 border-4 border-black bg-gray-100 flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-black text-lg uppercase text-black">
                    {profileForm.name || 'Your institution'}
                  </h3>
                  <p className="text-[11px] font-bold text-gray-500 uppercase">
                    Signed in as {user?.email}
                  </p>
                </div>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                    Institution Name
                  </label>
                  <input
                    type="text"
                    className="flat-input text-sm py-2"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      className="flat-input text-sm py-2 bg-gray-50 text-gray-400"
                      value={user?.email || ''}
                      disabled
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
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                    Address
                  </label>
                  <input
                    type="text"
                    className="flat-input text-sm py-2"
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flat-btn-blue text-xs font-black py-3 px-6 uppercase mt-2 inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : 'Update Profile'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {activeTab === 'password' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black uppercase border-b-4 border-black pb-3 text-black">
                Change password
              </h2>

              <div className="flat-border bg-blue-50 border-black p-4 flex items-start gap-2">
                <Info className="w-4 h-4 text-flatBlue shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold text-gray-700 uppercase leading-snug">
                  For security, password changes are handled via the forgot password flow. Click
                  below to receive a reset link at your registered email.
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

export default Settings;
