import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { adminAPI } from '../../services/api'
import { Users, GraduationCap, BookOpen, ClipboardList, Loader2, Shield } from 'lucide-react'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminAPI.getStats()
      .then((res) => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Paneli</h1>
        <p className="text-gray-500">Sistem yönetimi ve istatistikler</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <Users className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-2xl font-bold">{stats?.total_users || 0}</p>
          <p className="text-sm text-gray-500">Toplam Kullanıcı</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <GraduationCap className="w-8 h-8 text-green-500 mb-2" />
          <p className="text-2xl font-bold">{stats?.total_students || 0}</p>
          <p className="text-sm text-gray-500">Öğrenci</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <BookOpen className="w-8 h-8 text-purple-500 mb-2" />
          <p className="text-2xl font-bold">{stats?.total_courses || 0}</p>
          <p className="text-sm text-gray-500">Ders</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <ClipboardList className="w-8 h-8 text-red-500 mb-2" />
          <p className="text-2xl font-bold">{stats?.total_exams || 0}</p>
          <p className="text-sm text-gray-500">Sınav</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Link to="/admin/courses" className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition">
          <BookOpen className="w-10 h-10 text-purple-600 mb-3" />
          <h3 className="font-semibold">Ders Yönetimi</h3>
          <p className="text-sm text-gray-500">Ders oluştur ve eğitmen ata</p>
        </Link>
        <Link to="/admin/users" className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition">
          <Users className="w-10 h-10 text-blue-600 mb-3" />
          <h3 className="font-semibold">Kullanıcı Yönetimi</h3>
          <p className="text-sm text-gray-500">Kullanıcıları görüntüle</p>
        </Link>
        <Link to="/admin/enrollments" className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition">
          <GraduationCap className="w-10 h-10 text-green-600 mb-3" />
          <h3 className="font-semibold">Öğrenci Atamaları</h3>
          <p className="text-sm text-gray-500">Öğrencileri derslere kaydet</p>
        </Link>
        <Link to="/admin/proctor-assignments" className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition">
          <Shield className="w-10 h-10 text-indigo-600 mb-3" />
          <h3 className="font-semibold">Gözetmen Atamaları</h3>
          <p className="text-sm text-gray-500">Sınavlara atanan gözetmenler</p>
        </Link>
      </div>
    </div>
  )
}