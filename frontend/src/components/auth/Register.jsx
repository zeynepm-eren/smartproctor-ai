/**
 * SmartProctor - Kayıt Sayfası
 * Eğitmen/Gözetmen kaydı için gizli anahtar zorunlu.
 */

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Shield, UserPlus, Key } from 'lucide-react'

export default function Register() {
  const [form, setForm] = useState({
    email: '', password: '', first_name: '', last_name: '', role: 'student', secret_key: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const needsSecretKey = form.role === 'instructor' || form.role === 'proctor'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (needsSecretKey && !form.secret_key.trim()) {
      setError('Bu rol için gizli anahtar gereklidir')
      return
    }

    setLoading(true)
    try {
      const data = { ...form }
      if (!needsSecretKey) delete data.secret_key
      await register(data)
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.detail || 'Kayıt başarısız')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-2xl mb-4">
              <UserPlus className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Kayıt Ol</h1>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ad</label>
                <input name="first_name" value={form.first_name} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Soyad</label>
                <input name="last_name" value={form.last_name} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
              <input type="password" name="password" value={form.password} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required minLength={6} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select name="role" value={form.role} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="student">Öğrenci</option>
                <option value="instructor">Eğitmen</option>
                <option value="proctor">Gözetmen</option>
              </select>
            </div>

            {needsSecretKey && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Key size={14} className="inline mr-1" />
                  Gizli Anahtar
                </label>
                <input
                  type="password"
                  name="secret_key"
                  value={form.secret_key}
                  onChange={handleChange}
                  placeholder={form.role === 'instructor' ? 'Eğitmen gizli anahtarı' : 'Gözetmen gizli anahtarı'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Bu rol için yönetici tarafından sağlanan gizli anahtar gereklidir.
                </p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition">
              {loading ? 'Kaydediliyor...' : 'Kayıt Ol'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Zaten hesabınız var mı? <Link to="/login" className="text-blue-600 font-medium">Giriş Yap</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
