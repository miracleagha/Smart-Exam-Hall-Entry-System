import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Plus, 
  Edit2, 
  Trash2, 
  Archive, 
  X, 
  ChevronRight, 
  BookOpen, 
  AlertTriangle 
} from 'lucide-react';

const examSchema = zod.object({
  courseCode: zod.string().min(4, 'Course Code is required (e.g. CSC 401)'),
  title: zod.string().min(5, 'Course Title is required'),
  examDate: zod.string().min(10, 'Exam Date is required'),
  startTime: zod.string().min(4, 'Start Time is required (e.g. 09:00 AM)'),
  endTime: zod.string().min(4, 'End Time is required (e.g. 11:00 AM)'),
  venue: zod.string().min(4, 'Venue is required'),
  department: zod.string().min(2, 'Department is required'),
  faculty: zod.string().min(2, 'Faculty is required'),
  level: zod.string().min(2, 'Level is required')
});

export const Exams = () => {
  const { showToast } = useToast();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState('');

  // Suggestions for department / level pulled from the actual student pool
  // so admins can pick values that match their students exactly.
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [levelOptions, setLevelOptions] = useState([]);

  // Modal states
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(examSchema),
    defaultValues: {
      level: '400 Level',
      faculty: 'Science',
      department: 'Computer Science'
    }
  });

  const fetchExams = async () => {
    setLoading(true);
    try {
      const data = await api.exams.list();
      // Backend may return { exams, pagination } or a flat array
      setExams(Array.isArray(data) ? data : (data.exams || []));
    } catch (err) {
      showToast(err.message || 'Failed to fetch exams', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const opts = await api.students.getFilterOptions();
      setDepartmentOptions(opts?.departments || []);
      setLevelOptions(opts?.levels || []);
    } catch (_err) {
      // Non-fatal — the form falls back to free-text.
    }
  };

  useEffect(() => {
    fetchExams();
    fetchFilterOptions();
  }, []);

  const handleCreateSubmit = async (data) => {
    try {
      if (isEditing && selectedExam) {
        const examId = selectedExam._id || selectedExam.id;
        await api.exams.update(examId, data);
        showToast('Exam schedule updated successfully', 'success');
      } else {
        await api.exams.create(data);
        showToast('Exam scheduled successfully!', 'success');
      }
      setIsOpen(false);
      fetchExams();
    } catch (err) {
      showToast(err.message || 'Process failed.', 'error');
    }
  };

  const handleEdit = (exam) => {
    setSelectedExam(exam);
    setIsEditing(true);
    setIsOpen(true);
    setValue('courseCode', exam.courseCode);
    setValue('title', exam.title);
    // examDate from backend is ISO date — extract YYYY-MM-DD
    setValue('examDate', exam.examDate ? new Date(exam.examDate).toISOString().split('T')[0] : '');
    setValue('startTime', exam.startTime);
    setValue('endTime', exam.endTime);
    setValue('venue', exam.venue);
    setValue('department', exam.department);
    setValue('faculty', exam.faculty || '');
    setValue('level', exam.level);
  };

  const handleArchive = async (id) => {
    if (window.confirm('Are you sure you want to archive this exam? Students will no longer see it as active.')) {
      try {
        await api.exams.updateStatus(id, 'archived');
        showToast('Exam archived successfully', 'success');
        fetchExams();
      } catch (err) {
        showToast(err.message || 'Action failed', 'error');
      }
    }
  };

  const handleDelete = async (examId) => {
    if (window.confirm('Are you sure you want to permanently delete this exam? This will erase related records.')) {
      try {
        await api.exams.delete(examId);
        showToast('Exam deleted successfully', 'success');
        fetchExams();
      } catch (err) {
        showToast(err.message || 'Deletion failed', 'error');
      }
    }
  };

  const filteredExams = exams.filter(e => {
    return filterDept ? e.department.toLowerCase() === filterDept.toLowerCase() : true;
  });

  return (
    <div className="space-y-8 select-none">
      {/* Page Title */}
      <div className="flex items-center justify-between gap-4 border-b-4 border-black pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-black m-0 tracking-wide">Exams</h1>
          <p className="text-sm font-bold text-gray-500 uppercase mt-1">Schedule courses, coordinate venues, and archive completed sessions.</p>
        </div>
        <button
          onClick={() => {
            setIsEditing(false);
            reset();
            setIsOpen(true);
          }}
          className="flat-btn bg-flatBlue text-white hover:scale-102 flex items-center gap-2 py-3"
        >
          <Plus className="w-5 h-5 stroke-[3]" />
          Create Exam
        </button>
      </div>

      {/* Filter Row */}
      <div className="flat-card bg-white flex items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xs uppercase text-gray-500">Department Filter:</span>
          <select
            className="flat-select text-xs py-1.5 px-4"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            <option value="">All Departments</option>
            {departmentOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs font-black uppercase text-gray-500">
          Total Scheduled: {filteredExams.length} Exams
        </p>
      </div>

      {/* Grid of Exams */}
      {loading ? (
        <div className="flat-card bg-white p-12 text-center border-black">
          <div className="w-10 h-10 border-4 border-t-flatBlue border-black rounded-full animate-spin mx-auto mb-4" />
          <p className="font-extrabold text-sm uppercase text-gray-500">Loading Exam Schedules...</p>
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="flat-card bg-white p-12 text-center border-black">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-black uppercase text-black">No Exam Schedules</h3>
          <p className="text-xs font-bold text-gray-500 uppercase mt-1">Schedule a course exam session to begin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExams.map((exam) => (
            <div key={exam._id || exam.id} className="flat-card bg-white flex flex-col justify-between pt-6">
              {/* Header Badge */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="flat-badge bg-black text-white text-xs py-1 px-3 mb-2 font-black uppercase tracking-wide">
                    {exam.courseCode}
                  </span>
                  <h3 className="text-lg font-black uppercase text-black leading-tight mt-1 truncate max-w-[200px]" title={exam.title}>
                    {exam.title}
                  </h3>
                </div>
                <span
                  className={`flat-badge border-2 text-[10px] font-black py-0.5 px-2 ${
                    exam.status === 'active' ? 'bg-flatEmerald text-white' : 'bg-gray-400 text-black'
                  }`}
                >
                  {exam.status}
                </span>
              </div>

              {/* Details Pane */}
              <div className="space-y-2 border-t-2 border-black pt-4 pb-6 font-semibold text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-flatBlue shrink-0" />
                  <span className="uppercase font-black text-black">Date:</span>
                  <span>{exam.examDate ? new Date(exam.examDate).toLocaleDateString() : 'TBD'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-flatBlue shrink-0" />
                  <span className="uppercase font-black text-black">Time:</span>
                  <span>{exam.startTime} - {exam.endTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-flatBlue shrink-0" />
                  <span className="uppercase font-black text-black">Venue:</span>
                  <span className="truncate">{exam.venue}</span>
                </div>
                <div className="flex justify-between text-[10px] bg-gray-50 border border-black p-2 mt-2">
                  <span className="uppercase font-black text-gray-500">DEPT: {exam.department}</span>
                  <span className="uppercase font-black text-gray-500">LVL: {exam.level}</span>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex gap-2 border-t-2 border-black pt-4 mt-auto">
                <button
                  onClick={() => handleEdit(exam)}
                  className="flex-1 flat-border-sm p-2 bg-white hover:bg-flatBlue hover:text-white text-black font-extrabold text-[10px] uppercase flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>
                {(exam.status === 'active' || exam.status === 'upcoming') && (
                  <button
                    onClick={() => handleArchive(exam._id || exam.id)}
                    className="flex-1 flat-border-sm p-2 bg-white hover:bg-flatAmber text-black font-extrabold text-[10px] uppercase flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Archive
                  </button>
                )}
                <button
                  onClick={() => handleDelete(exam._id || exam.id)}
                  className="flat-border-sm p-2 bg-white hover:bg-red-500 hover:text-white text-black font-extrabold transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="flat-card bg-white max-w-md w-full border-black relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 flat-border-sm p-1 bg-white hover:bg-gray-100 cursor-pointer"
            >
              <X className="w-5 h-5 text-black" />
            </button>

            <h3 className="text-xl font-black uppercase border-b-4 border-black pb-3 mb-6 text-black">
              {isEditing ? 'Edit Exam Details' : 'Schedule New Exam'}
            </h3>

            <form onSubmit={handleSubmit(handleCreateSubmit)} className="space-y-4">
              {/* Course Code */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">Course Code</label>
                <input type="text" className="flat-input text-sm py-2" placeholder="e.g. CSC 401" {...register('courseCode')} />
                {errors.courseCode && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">{errors.courseCode.message}</p>}
              </div>

              {/* Course Title */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">Course Title</label>
                <input type="text" className="flat-input text-sm py-2" placeholder="e.g. Artificial Intelligence" {...register('title')} />
                {errors.title && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">Exam Date</label>
                  <input type="date" className="flat-input text-sm py-2" {...register('examDate')} />
                  {errors.examDate && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">{errors.examDate.message}</p>}
                </div>

                {/* Start Time */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">Start Time</label>
                  <input type="text" className="flat-input text-sm py-2" placeholder="e.g. 09:00 AM" {...register('startTime')} />
                  {errors.startTime && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">{errors.startTime.message}</p>}
                </div>
              </div>

              {/* End Time */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">End Time</label>
                <input type="text" className="flat-input text-sm py-2" placeholder="e.g. 11:00 AM" {...register('endTime')} />
                {errors.endTime && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">{errors.endTime.message}</p>}
              </div>

              {/* Venue */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">Venue Location</label>
                <input type="text" className="flat-input text-sm py-2" placeholder="e.g. Lecture Hall C" {...register('venue')} />
                {errors.venue && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">{errors.venue.message}</p>}
              </div>

              {/* Dept — free-text with autocomplete from existing student departments */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                  Department
                </label>
                <input
                  type="text"
                  list="exam-dept-options"
                  className="flat-input text-sm py-2"
                  placeholder="e.g. Computer Science"
                  {...register('department')}
                />
                <datalist id="exam-dept-options">
                  {departmentOptions.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
                <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase">
                  Must match the student's department for them to see this exam.
                </p>
                {errors.department && (
                  <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">
                    {errors.department.message}
                  </p>
                )}
              </div>

              {/* Faculty — free text */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                  Faculty
                </label>
                <input
                  type="text"
                  className="flat-input text-sm py-2"
                  placeholder="e.g. Science"
                  {...register('faculty')}
                />
                {errors.faculty && (
                  <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">
                    {errors.faculty.message}
                  </p>
                )}
              </div>

              {/* Level */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                  Academic Level
                </label>
                <select className="flat-select text-sm py-2" {...register('level')}>
                  {(levelOptions.length > 0
                    ? levelOptions
                    : ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level']
                  ).map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase">
                  Options are drawn from your existing student records.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t-4 border-black">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flat-btn bg-white hover:bg-gray-100 py-2 px-6 text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flat-btn bg-flatBlue text-white hover:scale-102 py-2 px-6 text-xs uppercase"
                >
                  {isEditing ? 'Save Changes' : 'Schedule Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Exams;
