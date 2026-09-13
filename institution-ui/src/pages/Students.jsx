import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, resolveMediaUrl } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import {
  Search,
  Plus,
  Edit2,
  Lock,
  Unlock,
  Eye,
  FileSpreadsheet,
  Download,
  X,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserMinus,
  Mail,
  Phone,
  FileText,
  User,
  Upload,
} from 'lucide-react';

// Base student schema — passport photo is handled outside the form because
// react-hook-form + zod are awkward with File inputs, and the field is
// optional anyway (institution can add/change it later).
const studentSchema = zod.object({
  firstName: zod.string().min(2, 'First Name is required'),
  lastName: zod.string().min(2, 'Last Name is required'),
  otherName: zod.string().optional().or(zod.literal('')),
  matricNumber: zod.string().min(3, 'Matric Number is required'),
  department: zod.string().min(2, 'Department is required'),
  faculty: zod.string().min(2, 'Faculty is required'),
  level: zod.string().min(2, 'Level is required'),
  phone: zod.string().min(6, 'Phone number is required'),
  email: zod.string().email('Please enter a valid email address'),
  gender: zod.enum(['male', 'female', 'other']),
  dateOfBirth: zod.string().optional().or(zod.literal('')),
});

const idOf = (s) => s?._id || s?.id;

export const Students = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [levelOptions, setLevelOptions] = useState([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [generatedCreds, setGeneratedCreds] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Photo upload state for the create/edit form
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      gender: 'male',
      level: '400 Level',
    },
  });

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const data = await api.students.list({
        search: searchQuery,
        department: filterDept,
        level: filterLevel,
        status: filterStatus,
        limit: 500,
      });
      const rows = Array.isArray(data) ? data : data?.students || [];
      setStudents(rows);
    } catch (err) {
      showToast(err.message || 'Failed to fetch students.', 'error');
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
      // Non-fatal
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchFilterOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Re-fetch when server-side filters change (debounced by useEffect timing).
  useEffect(() => {
    const t = setTimeout(fetchStudents, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filterDept, filterLevel, filterStatus]);

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedStudent(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    reset({
      firstName: '',
      lastName: '',
      otherName: '',
      matricNumber: '',
      department: '',
      faculty: '',
      level: '400 Level',
      phone: '',
      email: '',
      gender: 'male',
      dateOfBirth: '',
    });
    setIsCreateOpen(true);
  };

  const openEditModal = (student) => {
    setSelectedStudent(student);
    setIsEditing(true);
    setPhotoFile(null);
    setPhotoPreview(resolveMediaUrl(student.passportPhoto) || null);
    setValue('firstName', student.firstName || '');
    setValue('lastName', student.lastName || '');
    setValue('otherName', student.otherName || '');
    setValue('matricNumber', student.matricNumber || '');
    setValue('department', student.department || '');
    setValue('faculty', student.faculty || '');
    setValue('level', student.level || '');
    setValue('phone', student.phone || '');
    setValue('email', student.email || '');
    setValue('gender', (student.gender || 'male').toLowerCase());
    setValue(
      'dateOfBirth',
      student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().slice(0, 10) : ''
    );
    setIsCreateOpen(true);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be smaller than 5MB.', 'error');
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCreateSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        gender: formData.gender?.toLowerCase(),
      };
      if (photoFile) payload.passportPhoto = photoFile;

      if (isEditing && selectedStudent) {
        await api.students.update(idOf(selectedStudent), payload);
        showToast('Student record updated.', 'success');
      } else {
        const result = await api.students.create(payload);
        const creds = result?.credentials || {};
        const student = result?.student || result;
        setGeneratedCreds({
          name: `${student.firstName} ${student.lastName}`,
          username: creds.username || student.username,
          password: creds.temporaryPassword || 'See email',
          matric: student.matricNumber,
        });
        showToast('Student enrolled successfully.', 'success');
      }
      setIsCreateOpen(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      fetchStudents();
      fetchFilterOptions();
    } catch (err) {
      showToast(err.message || 'Save failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSuspend = async (student) => {
    try {
      const nextStatus = student.status === 'active' ? 'suspended' : 'active';
      await api.students.updateStatus(idOf(student), nextStatus);
      showToast(
        nextStatus === 'active' ? 'Student account activated.' : 'Student account suspended.',
        nextStatus === 'active' ? 'success' : 'warning'
      );
      fetchStudents();
    } catch (err) {
      showToast(err.message || 'Status change failed.', 'error');
    }
  };

  const openViewModal = (student) => {
    setSelectedStudent(student);
    setIsViewOpen(true);
  };

  const copyCreds = () => {
    if (!generatedCreds) return;
    const text = `Student Account Credentials:\nName: ${generatedCreds.name}\nMatric: ${generatedCreds.matric}\nUsername: ${generatedCreds.username}\nPassword: ${generatedCreds.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('Credentials copied.', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const exportBackend = async (format) => {
    try {
      const blob = await api.students.export(format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `students_export.${format === 'excel' || format === 'xlsx' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Export downloaded.', 'success');
    } catch (err) {
      showToast(err.message || 'Export failed.', 'error');
    }
  };

  // Server already applied filters; client-side is a light safety net for
  // stale search terms while a fetch is in flight.
  const filteredStudents = students;

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / itemsPerPage));
  const paginatedStudents = useMemo(
    () => filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [filteredStudents, currentPage]
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <div className="space-y-8 select-none">
      {/* Title */}
      <div className="flex items-center justify-between gap-4 border-b-4 border-black pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-black m-0 tracking-wide">Students</h1>
          <p className="text-sm font-bold text-gray-500 uppercase mt-1">
            Enroll students, upload their passport photos, and manage their accounts.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={openCreateModal}
            className="flat-btn bg-flatBlue text-white hover:scale-102 flex items-center gap-2 py-3 cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[3]" />
            Add Student
          </button>
        </div>
      </div>

      {/* Credentials banner */}
      {generatedCreds && (
        <div className="flat-card bg-flatEmerald text-black border-black relative">
          <button
            onClick={() => setGeneratedCreds(null)}
            className="absolute top-4 right-4 flat-border-sm p-1 bg-white cursor-pointer"
          >
            <X className="w-4 h-4 text-black" />
          </button>

          <h3 className="font-black uppercase text-lg mb-2 flex items-center gap-2">
            <UserCheck className="w-6 h-6 stroke-[2.5]" />
            Student account generated
          </h3>
          <p className="text-xs font-extrabold uppercase text-green-900 mb-4">
            Share these credentials with the student. If an email was provided, they've already been emailed.
          </p>

          <div className="flat-border bg-white p-4 max-w-md divide-y-2 divide-black">
            <div className="py-2 flex justify-between text-xs">
              <span className="font-extrabold uppercase">Name</span>
              <span className="font-black text-flatBlue">{generatedCreds.name}</span>
            </div>
            <div className="py-2 flex justify-between text-xs">
              <span className="font-extrabold uppercase">Matric Number</span>
              <span className="font-black">{generatedCreds.matric}</span>
            </div>
            <div className="py-2 flex justify-between text-xs">
              <span className="font-extrabold uppercase">Login Username</span>
              <span className="font-black font-mono">{generatedCreds.username}</span>
            </div>
            <div className="py-2 flex justify-between text-xs">
              <span className="font-extrabold uppercase">Temp Password</span>
              <span className="font-black font-mono text-red-600">{generatedCreds.password}</span>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={copyCreds}
              className="flat-btn bg-white text-black hover:scale-102 flex items-center gap-1.5 py-2 px-4 text-xs font-black uppercase cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-flatEmerald" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={() => setGeneratedCreds(null)}
              className="flat-btn bg-black text-white hover:scale-102 py-2 px-4 text-xs font-black uppercase cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flat-card bg-white grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative md:col-span-2">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-black">
            <Search className="w-5 h-5 stroke-[2.5]" />
          </div>
          <input
            type="text"
            placeholder="Search by name or matric..."
            className="flat-input pl-11 py-2 text-sm"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <select
          className="flat-select py-2 text-sm bg-no-repeat bg-[right_16px_center]"
          value={filterDept}
          onChange={(e) => {
            setFilterDept(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="">All departments</option>
          {departmentOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          className="flat-select py-2 text-sm"
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>

        {levelOptions.length > 0 && (
          <select
            className="flat-select py-2 text-sm md:col-span-4"
            value={filterLevel}
            onChange={(e) => {
              setFilterLevel(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All levels</option>
            {levelOptions.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Export + count */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <p className="text-xs font-black uppercase text-gray-500">
          Showing {paginatedStudents.length} of {filteredStudents.length} students
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => exportBackend('csv')}
            className="flat-btn bg-white hover:scale-105 py-2 px-4 text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => exportBackend('xlsx')}
            className="flat-btn bg-white hover:scale-105 py-2 px-4 text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-flatEmerald" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flat-card bg-white p-12 text-center border-black">
          <div className="w-10 h-10 border-4 border-t-flatBlue border-black rounded-full animate-spin mx-auto mb-4" />
          <p className="font-extrabold text-sm uppercase text-gray-500">Loading students...</p>
        </div>
      ) : paginatedStudents.length === 0 ? (
        <div className="flat-card bg-white p-12 text-center border-black">
          <UserMinus className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-black uppercase text-black">No students found</h3>
          <p className="text-xs font-bold text-gray-500 uppercase mt-1">
            Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <div className="flat-card bg-white p-0 border-black overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-black text-white uppercase text-xs tracking-wider border-b-4 border-black">
                <th className="p-4 font-black">Photo</th>
                <th className="p-4 font-black">Matric</th>
                <th className="p-4 font-black">Name</th>
                <th className="p-4 font-black">Department</th>
                <th className="p-4 font-black">Level</th>
                <th className="p-4 font-black">Status</th>
                <th className="p-4 font-black text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black">
              {paginatedStudents.map((student) => (
                <tr key={idOf(student)} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    {resolveMediaUrl(student.passportPhoto) ? (
                      <img
                        src={resolveMediaUrl(student.passportPhoto)}
                        alt="Student"
                        className="w-10 h-10 border-2 border-black object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 border-2 border-black bg-gray-100 flex items-center justify-center text-xs font-black text-gray-400">
                        {student.firstName?.[0]}
                        {student.lastName?.[0]}
                      </div>
                    )}
                  </td>
                  <td className="p-4 font-black text-sm text-flatBlue">{student.matricNumber}</td>
                  <td className="p-4 font-black text-sm text-black">
                    {student.lastName}, {student.firstName}
                  </td>
                  <td className="p-4 font-bold text-xs uppercase text-gray-700">{student.department}</td>
                  <td className="p-4 font-extrabold text-xs text-black">{student.level}</td>
                  <td className="p-4">
                    <span
                      className={`flat-badge border-2 ${
                        student.status === 'active'
                          ? 'bg-flatEmerald text-white'
                          : 'bg-red-500 text-white'
                      }`}
                    >
                      {student.status === 'active' ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openViewModal(student)}
                        className="flat-border-sm p-1.5 bg-white hover:bg-gray-100 text-black transition-colors cursor-pointer"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(student)}
                        className="flat-border-sm p-1.5 bg-white hover:bg-flatBlue hover:text-white text-black transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleSuspend(student)}
                        className={`flat-border-sm p-1.5 bg-white transition-colors cursor-pointer ${
                          student.status === 'active'
                            ? 'hover:bg-flatAmber text-black'
                            : 'hover:bg-flatEmerald hover:text-white text-black'
                        }`}
                        title={student.status === 'active' ? 'Suspend' : 'Activate'}
                      >
                        {student.status === 'active' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="p-4 border-t-4 border-black bg-gray-50 flex items-center justify-between gap-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="flat-border-sm px-3 py-1.5 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none font-bold text-xs uppercase flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <div className="flex gap-1.5">
                {[...Array(totalPages)].map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePageChange(idx + 1)}
                    className={`flat-border-sm px-3 py-1.5 font-black text-xs cursor-pointer ${
                      currentPage === idx + 1 ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="flat-border-sm px-3 py-1.5 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none font-bold text-xs uppercase flex items-center gap-1 cursor-pointer"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="flat-card bg-white max-w-2xl w-full border-black max-h-[90vh] overflow-y-auto relative my-8">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 flat-border-sm p-1 bg-white hover:bg-gray-100 cursor-pointer"
            >
              <X className="w-5 h-5 text-black" />
            </button>

            <h3 className="text-xl font-black uppercase border-b-4 border-black pb-3 mb-6 text-black">
              {isEditing ? 'Edit student' : 'Enroll new student'}
            </h3>

            <form onSubmit={handleSubmit(handleCreateSubmit)} className="space-y-4">
              {/* Passport photo uploader */}
              <div className="flex items-center gap-4 pb-4 border-b-2 border-dashed border-gray-300">
                <div className="shrink-0">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-24 h-28 border-4 border-black object-cover"
                    />
                  ) : (
                    <div className="w-24 h-28 border-4 border-black bg-gray-100 flex items-center justify-center">
                      <User className="w-10 h-10 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                    Passport Photo
                  </label>
                  <label className="flat-btn bg-white hover:bg-gray-100 inline-flex items-center gap-2 py-2 px-4 text-xs font-black uppercase cursor-pointer">
                    <Upload className="w-4 h-4" />
                    {photoPreview ? 'Replace photo' : 'Upload photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                  </label>
                  <p className="text-[10px] font-bold text-gray-500 uppercase mt-2 leading-snug">
                    JPEG, PNG, GIF or WebP. Max 5 MB. This photo appears on the student's QR record.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                    First Name
                  </label>
                  <input type="text" className="flat-input text-sm py-2" {...register('firstName')} />
                  {errors.firstName && (
                    <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">
                      {errors.firstName.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                    Last Name
                  </label>
                  <input type="text" className="flat-input text-sm py-2" {...register('lastName')} />
                  {errors.lastName && (
                    <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">
                      {errors.lastName.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                    Other Name
                  </label>
                  <input
                    type="text"
                    className="flat-input text-sm py-2"
                    placeholder="Optional"
                    {...register('otherName')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                    Matric Number
                  </label>
                  <input
                    type="text"
                    className="flat-input text-sm py-2"
                    {...register('matricNumber')}
                    disabled={isEditing}
                  />
                  {errors.matricNumber && (
                    <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">
                      {errors.matricNumber.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                    Department
                  </label>
                  <input type="text" className="flat-input text-sm py-2" {...register('department')} />
                  {errors.department && (
                    <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">
                      {errors.department.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                    Faculty
                  </label>
                  <input type="text" className="flat-input text-sm py-2" {...register('faculty')} />
                  {errors.faculty && (
                    <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">
                      {errors.faculty.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                    Level
                  </label>
                  <select className="flat-select text-sm py-2" {...register('level')}>
                    <option value="100 Level">100 Level</option>
                    <option value="200 Level">200 Level</option>
                    <option value="300 Level">300 Level</option>
                    <option value="400 Level">400 Level</option>
                    <option value="500 Level">500 Level</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                    Phone
                  </label>
                  <input type="text" className="flat-input text-sm py-2" {...register('phone')} />
                  {errors.phone && (
                    <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">
                      {errors.phone.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                    Email
                  </label>
                  <input type="email" className="flat-input text-sm py-2" {...register('email')} />
                  {errors.email && (
                    <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                    Gender
                  </label>
                  <select className="flat-select text-sm py-2" {...register('gender')}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black">
                    Date of Birth
                  </label>
                  <input type="date" className="flat-input text-sm py-2" {...register('dateOfBirth')} />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t-4 border-black">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flat-btn bg-white hover:bg-gray-100 py-2 px-6 text-xs uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flat-btn bg-flatBlue text-white hover:scale-102 py-2 px-6 text-xs uppercase cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View modal */}
      {isViewOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="flat-card bg-white max-w-md w-full border-black relative">
            <button
              onClick={() => setIsViewOpen(false)}
              className="absolute top-4 right-4 flat-border-sm p-1 bg-white hover:bg-gray-100 cursor-pointer"
            >
              <X className="w-5 h-5 text-black" />
            </button>

            <h3 className="text-xl font-black uppercase border-b-4 border-black pb-3 mb-6 text-black flex items-center gap-1.5">
              <FileText className="w-5 h-5 text-flatBlue" />
              Student profile
            </h3>

            <div className="flex flex-col items-center mb-6">
              {resolveMediaUrl(selectedStudent.passportPhoto) ? (
                <img
                  src={resolveMediaUrl(selectedStudent.passportPhoto)}
                  alt="Student"
                  className="w-28 h-28 border-4 border-black object-cover mb-3"
                />
              ) : (
                <div className="w-28 h-28 border-4 border-black bg-gray-100 flex items-center justify-center mb-3">
                  <User className="w-12 h-12 text-gray-400" />
                </div>
              )}
              <h2 className="text-xl font-black text-black text-center">
                {selectedStudent.lastName}, {selectedStudent.firstName} {selectedStudent.otherName}
              </h2>
              <span className="flat-badge bg-gray-100 border-black text-black font-black uppercase text-xs py-1 px-3 mt-1">
                {selectedStudent.matricNumber}
              </span>
            </div>

            <div className="space-y-3 font-semibold text-xs border-y-4 border-black py-4">
              <div className="flex justify-between">
                <span className="uppercase text-gray-500 font-black">Department</span>
                <span className="font-extrabold text-black">{selectedStudent.department}</span>
              </div>
              <div className="flex justify-between">
                <span className="uppercase text-gray-500 font-black">Faculty</span>
                <span className="font-extrabold text-black">{selectedStudent.faculty}</span>
              </div>
              <div className="flex justify-between">
                <span className="uppercase text-gray-500 font-black">Level</span>
                <span className="font-extrabold text-black">{selectedStudent.level}</span>
              </div>
              <div className="flex justify-between">
                <span className="uppercase text-gray-500 font-black">Gender</span>
                <span className="font-extrabold text-black capitalize">{selectedStudent.gender}</span>
              </div>
              <div className="flex justify-between">
                <span className="uppercase text-gray-500 font-black">Username</span>
                <span className="font-extrabold text-black font-mono">{selectedStudent.username}</span>
              </div>
              {selectedStudent.dateOfBirth && (
                <div className="flex justify-between">
                  <span className="uppercase text-gray-500 font-black">Date of birth</span>
                  <span className="font-extrabold text-black">
                    {new Date(selectedStudent.dateOfBirth).toLocaleDateString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="uppercase text-gray-500 font-black">Phone</span>
                <span className="font-extrabold text-black flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {selectedStudent.phone || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="uppercase text-gray-500 font-black">Email</span>
                <span className="font-extrabold text-black flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {selectedStudent.email || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="uppercase text-gray-500 font-black">Status</span>
                <span
                  className={`flat-badge text-[10px] font-black border-2 py-0.5 px-2 ${
                    selectedStudent.status === 'active'
                      ? 'bg-flatEmerald text-white'
                      : 'bg-red-500 text-white'
                  }`}
                >
                  {selectedStudent.status === 'active' ? 'Active' : 'Suspended'}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsViewOpen(false);
                  openEditModal(selectedStudent);
                }}
                className="flat-btn bg-flatBlue text-white hover:scale-102 text-xs py-2 px-6 uppercase cursor-pointer"
              >
                Edit
              </button>
              <button
                onClick={() => setIsViewOpen(false)}
                className="flat-btn bg-black text-white hover:scale-102 text-xs py-2 px-6 uppercase cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;
