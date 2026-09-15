import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  BookOpen,
  MapPin,
  Calendar,
  Clock,
  GraduationCap,
  CheckCircle2,
  FileX,
  Loader2,
  RefreshCw,
  Info,
} from 'lucide-react';

export const AvailableExams = () => {
  const { showToast } = useToast();

  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registeringId, setRegisteringId] = useState(null);

  const loadExams = async () => {
    setLoading(true);
    try {
      const result = await api.exams.available();
      setExams(Array.isArray(result) ? result : []);
    } catch (err) {
      showToast('Failed to load available exams', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, []);

  const handleRegister = async (exam) => {
    setRegisteringId(exam._id);
    try {
      const result = await api.exams.register(exam._id);
      showToast(result?.exam ? 'Successfully registered for exam.' : 'Registration successful.', 'success');
      // Auto-approved: remove from available list
      setExams((prev) => prev.filter((e) => e._id !== exam._id));
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to register for exam.';
      showToast(message, 'error');
    } finally {
      setRegisteringId(null);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (time) => time || 'TBA';

  return (
    <div className="space-y-8 select-none">
      {/* Title */}
      <div className="flex items-center justify-between gap-4 border-b-4 border-black pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-black m-0 tracking-wide">Available Exams</h1>
          <p className="text-sm font-bold text-gray-500 uppercase mt-1">
            Exams offered to your department + level. Registration is auto-approved.
          </p>
        </div>
        <button
          onClick={loadExams}
          className="flat-btn bg-white hover:scale-102 flex items-center gap-2 py-2.5 px-4 text-xs font-black uppercase cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Notice: every exam whose date hasn't passed is listed. */}
      <div className="flat-card bg-blue-50 border-black p-3 flex items-start gap-3">
        <Info className="w-4 h-4 text-flatBlue shrink-0 mt-0.5" />
        <p className="text-[11px] font-bold text-gray-700 uppercase leading-snug">
          Every exam posted by your institution whose date hasn't passed is listed here — sorted
          by the earliest one first. Tap register on the ones you plan to sit.
        </p>
      </div>

      {loading ? (
        <div className="flat-card bg-white p-12 text-center border-black">
          <div className="w-10 h-10 border-4 border-t-flatBlue border-black rounded-full animate-spin mx-auto mb-4" />
          <p className="font-extrabold text-sm uppercase text-gray-500">Loading Available Exams...</p>
        </div>
      ) : exams.length === 0 ? (
        <div className="flat-card bg-white p-12 text-center border-black">
          <FileX className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-black uppercase text-black">No Exams Available</h3>
          <p className="text-xs font-bold text-gray-500 uppercase mt-1 max-w-md mx-auto leading-snug">
            Your institution hasn't posted any upcoming exams yet, or you've already registered
            for everything on the calendar. Check back later.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {exams.map((exam) => {
            const isRegistering = registeringId === exam._id;
            return (
              <div key={exam._id} className="flat-card bg-white border-black p-0 flex flex-col">
                {/* Header strip */}
                <div className="bg-black text-white px-4 py-3 border-b-4 border-black flex items-center gap-2">
                  <BookOpen className="w-4 h-4 stroke-[3]" />
                  <span className="font-black text-xs uppercase tracking-wider">
                    {exam.courseCode || 'COURSE'}
                  </span>
                </div>

                {/* Body */}
                <div className="p-5 flex-1 flex flex-col gap-3">
                  <h3 className="text-lg font-black uppercase text-black leading-tight">
                    {exam.title || 'Untitled Exam'}
                  </h3>

                  <div className="flex flex-wrap gap-2">
                    <span className="flat-badge border-2 border-black bg-flatAmber text-black text-[10px] font-black py-0.5 px-2.5 uppercase">
                      {exam.department || 'Dept'}
                    </span>
                    <span className="flat-badge border-2 border-black bg-flatBlue text-white text-[10px] font-black py-0.5 px-2.5 uppercase">
                      Level {exam.level || 'N/A'}
                    </span>
                    <span
                      className={`flat-badge border-2 border-black text-[10px] font-black py-0.5 px-2.5 uppercase ${
                        exam.status === 'active'
                          ? 'bg-flatEmerald text-white'
                          : 'bg-white text-black'
                      }`}
                    >
                      {exam.status || 'upcoming'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-bold text-gray-700 mt-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-black stroke-[3]" />
                      <span>{formatDate(exam.examDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-black stroke-[3]" />
                      <span>
                        {formatTime(exam.startTime)} - {formatTime(exam.endTime)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-black stroke-[3]" />
                      <span className="uppercase">{exam.venue || 'TBA'}</span>
                    </div>
                    {exam.duration ? (
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-3.5 h-3.5 text-black stroke-[3]" />
                        <span>{exam.duration} minutes</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t-4 border-black p-4">
                  <button
                    onClick={() => handleRegister(exam)}
                    disabled={isRegistering}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-black bg-flatEmerald hover:bg-black text-white font-black uppercase text-xs tracking-widest transition-all hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {isRegistering ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                        Register
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AvailableExams;
