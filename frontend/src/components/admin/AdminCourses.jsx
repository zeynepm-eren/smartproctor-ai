import { useState, useEffect } from 'react'
import { courseAPI, authAPI } from '../../services/api'
import { BookOpen, Plus, UserPlus, UserMinus, X, Loader2, AlertCircle } from 'lucide-react'

export default function AdminCourses() {
  const [courses, setCourses] = useState([])
  const [instructors, setInstructors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [newCourse, setNewCourse] = useState({ code: '', name: '', description: '' })
  const [error, setError] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const [c, i] = await Promise.all([courseAPI.listAll(), authAPI.getInstructors()])
      setCourses(c.data)
      setInstructors(i.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await courseAPI.create(newCourse)
      setShowCreateModal(false)
      setNewCourse({ code: '', name: '', description: '' })
      loadData()
    } catch (err) { setError(err.response?.data?.detail || 'Hata oluştu') }
  }

  const handleAssign = async (instructorId) => {
    try {
      await courseAPI.assignInstructor(selectedCourse.id, instructorId)
      setShowAssignModal(false)
      loadData()
    } catch (err) { alert(err.response?.data?.detail || 'Hata') }
  }

  const handleRemove = async (courseId) => {
    if (!confirm('Eğitmeni kaldırmak istediğinize emin misiniz?')) return
    try {
      await courseAPI.removeInstructor(courseId)
      loadData()
    } catch (err) { alert(err.response?.data?.detail || 'Hata') }
  }

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Ders Yönetimi</h1>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={20} /> Yeni Ders
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Kod</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Ders Adı</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Eğitmen</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {courses.map((course) => (
              <tr key={course.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-sm">{course.code}</td>
                <td className="px-6 py-4 font-medium">{course.name}</td>
                <td className="px-6 py-4">
                  {course.instructor ? (
                    <span>{course.instructor.first_name} {course.instructor.last_name}</span>
                  ) : (
                    <span className="text-orange-600 flex items-center gap-1"><AlertCircle size={16} /> Atanmadı</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {course.instructor ? (
                    <button onClick={() => handleRemove(course.id)} className="text-red-600 hover:text-red-700"><UserMinus size={18} /></button>
                  ) : (
                    <button onClick={() => { setSelectedCourse(course); setShowAssignModal(true) }} className="text-blue-600 hover:text-blue-700"><UserPlus size={18} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {courses.length === 0 && <div className="text-center py-12 text-gray-500">Henüz ders yok</div>}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-semibold">Yeni Ders</h2>
              <button onClick={() => setShowCreateModal(false)}><X size={20} /></button>
            </div>
            {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-4">
              <input type="text" placeholder="Ders Kodu (örn: BIL101)" value={newCourse.code} onChange={(e) => setNewCourse({...newCourse, code: e.target.value})} className="w-full px-3 py-2 border rounded-lg" required />
              <input type="text" placeholder="Ders Adı" value={newCourse.name} onChange={(e) => setNewCourse({...newCourse, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" required />
              <textarea placeholder="Açıklama (isteğe bağlı)" value={newCourse.description} onChange={(e) => setNewCourse({...newCourse, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg" rows={3} />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2 border rounded-lg">İptal</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg">Oluştur</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && selectedCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-semibold">Eğitmen Ata - {selectedCourse.name}</h2>
              <button onClick={() => setShowAssignModal(false)}><X size={20} /></button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {instructors.map((inst) => (
                <button key={inst.id} onClick={() => handleAssign(inst.id)} className="w-full flex items-center gap-3 p-3 rounded-lg border hover:border-blue-300 hover:bg-blue-50 text-left">
                  <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-medium">
                    {inst.first_name[0]}{inst.last_name[0]}
                  </div>
                  <div>
                    <p className="font-medium">{inst.first_name} {inst.last_name}</p>
                    <p className="text-sm text-gray-500">{inst.email}</p>
                  </div>
                </button>
              ))}
              {instructors.length === 0 && <p className="text-center text-gray-500 py-4">Eğitmen bulunamadı</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}