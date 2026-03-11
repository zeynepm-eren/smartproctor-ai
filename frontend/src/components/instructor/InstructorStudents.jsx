import { useState, useEffect } from 'react'
import { courseAPI, authAPI } from '../../services/api'
import { GraduationCap, BookOpen, UserPlus, UserMinus, Loader2, Search } from 'lucide-react'

export default function InstructorStudents() {
  const [courses, setCourses] = useState([])
  const [students, setStudents] = useState([])
  const [enrolledStudents, setEnrolledStudents] = useState([])
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (selectedCourse) loadEnrolled() }, [selectedCourse])

  const loadData = async () => {
    try {
      const [c, s] = await Promise.all([courseAPI.list(), authAPI.getStudents()])
      setCourses(c.data)
      setStudents(s.data)
      if (c.data.length > 0) setSelectedCourse(c.data[0])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const loadEnrolled = async () => {
    try {
      const res = await courseAPI.students(selectedCourse.id)
      setEnrolledStudents(res.data)
    } catch (err) { console.error(err) }
  }

  const handleEnroll = async (studentId) => {
    try {
      await courseAPI.enroll(selectedCourse.id, studentId)
      loadEnrolled()
    } catch (err) { alert(err.response?.data?.detail || 'Hata') }
  }

  const handleUnenroll = async (studentId) => {
    if (!confirm('Öğrenciyi çıkarmak istediğinize emin misiniz?')) return
    try {
      await courseAPI.unenroll(selectedCourse.id, studentId)
      loadEnrolled()
    } catch (err) { alert(err.response?.data?.detail || 'Hata') }
  }

  const enrolledIds = enrolledStudents.map(e => e.student_id)
  const unenrolled = students.filter(s => !enrolledIds.includes(s.id))
  const filtered = unenrolled.filter(s => 
    s.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.last_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>

  if (courses.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Henüz Dersiniz Yok</h2>
        <p className="text-gray-500">Size atanmış bir ders bulunmuyor.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Öğrenci Yönetimi</h1>

      <div className="flex flex-wrap gap-2">
        {courses.map(course => (
          <button key={course.id} onClick={() => setSelectedCourse(course)}
            className={`px-4 py-2 rounded-lg font-medium transition ${selectedCourse?.id === course.id ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
            {course.code}
          </button>
        ))}
      </div>

      {selectedCourse && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2 text-green-700"><GraduationCap size={20} /> Kayıtlı ({enrolledStudents.length})</h2>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {enrolledStudents.map(e => (
                <div key={e.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span>{e.student?.first_name} {e.student?.last_name}</span>
                  <button onClick={() => handleUnenroll(e.student_id)} className="text-red-600"><UserMinus size={18} /></button>
                </div>
              ))}
              {enrolledStudents.length === 0 && <p className="text-gray-500 text-center py-4">Kayıtlı öğrenci yok</p>}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2 text-blue-700"><GraduationCap size={20} /> Kayıtsız ({unenrolled.length})</h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type="text" placeholder="Ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm" />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filtered.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span>{s.first_name} {s.last_name}</span>
                  <button onClick={() => handleEnroll(s.id)} className="text-blue-600"><UserPlus size={18} /></button>
                </div>
              ))}
              {filtered.length === 0 && <p className="text-gray-500 text-center py-4">Öğrenci bulunamadı</p>}
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">💡 Bir öğrenciyi derse kaydettiğinizde, bu derse ait sınavlar otomatik olarak öğrencinin panelinde görünür.</p>
      </div>
    </div>
  )
}