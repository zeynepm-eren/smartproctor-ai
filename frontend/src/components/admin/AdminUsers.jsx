import { useState, useEffect } from 'react'
import { authAPI } from '../../services/api'
import { Users, Search, Loader2 } from 'lucide-react'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  useEffect(() => { loadUsers() }, [roleFilter])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await authAPI.getUsers({ role: roleFilter || undefined })
      setUsers(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const filtered = users.filter(u =>
    u.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const roleLabel = { student: 'Öğrenci', instructor: 'Eğitmen', proctor: 'Gözetmen', admin: 'Admin' }
  const roleColor = { student: 'bg-green-100 text-green-700', instructor: 'bg-blue-100 text-blue-700', proctor: 'bg-yellow-100 text-yellow-700', admin: 'bg-purple-100 text-purple-700' }

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Kullanıcı Yönetimi</h1>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input type="text" placeholder="Ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-4 py-2 border rounded-lg">
          <option value="">Tüm Roller</option>
          <option value="student">Öğrenci</option>
          <option value="instructor">Eğitmen</option>
          <option value="proctor">Gözetmen</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Kullanıcı</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Email</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Rol</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{user.first_name} {user.last_name}</td>
                <td className="px-6 py-4 text-gray-600">{user.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${roleColor[user.role]}`}>
                    {roleLabel[user.role]}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {user.is_active ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-gray-500">Kullanıcı bulunamadı</div>}
      </div>
    </div>
  )
}