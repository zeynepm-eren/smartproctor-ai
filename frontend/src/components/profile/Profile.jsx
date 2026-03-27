import { useState, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { authAPI } from '../../services/api'
import { User, Mail, Lock, Camera, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'

export default function Profile() {
  const { user, updateUser } = useAuth()
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (form.new_password && form.new_password !== form.confirm_password) {
      setError('Yeni şifreler eşleşmiyor')
      return
    }
    if (form.new_password && form.new_password.length < 6) {
      setError('Yeni şifre en az 6 karakter olmalıdır')
      return
    }

    setSaving(true)
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
      }
      if (form.new_password) {
        payload.current_password = form.current_password
        payload.new_password = form.new_password
      }
      const res = await authAPI.updateProfile(payload)
      updateUser(res.data)
      setSuccess('Profil başarıyla güncellendi')
      setForm(prev => ({ ...prev, current_password: '', new_password: '', confirm_password: '' }))
    } catch (err) {
      setError(err.response?.data?.detail || 'Güncelleme başarısız')
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    setError('')
    try {
      const res = await authAPI.uploadProfilePhoto(file)
      updateUser(res.data)
      setSuccess('Profil fotoğrafı güncellendi')
    } catch {
      setError('Fotoğraf yüklenemedi')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const roleLabel = { student: 'Öğrenci', instructor: 'Eğitmen', proctor: 'Gözetmen', admin: 'Admin' }
  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase()

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profilim</h1>

      {/* Fotoğraf */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            {user?.profile_photo_url ? (
              <img
                src={user.profile_photo_url}
                alt="Profil"
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow">
                {initials}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute bottom-0 right-0 w-8 h-8 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 shadow-sm"
            >
              {uploadingPhoto ? <Loader2 size={14} className="animate-spin text-blue-600" /> : <Camera size={14} className="text-gray-600" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{user?.first_name} {user?.last_name}</h2>
            <p className="text-gray-500 text-sm">{user?.email}</p>
            <span className="mt-1 inline-block text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
              {roleLabel[user?.role] || user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Bilgi Güncelleme Formu */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Bilgileri Güncelle</h3>

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
            <CheckCircle size={16} /> {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ad</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Soyad</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Şifre Değiştir <span className="text-gray-400 font-normal">(opsiyonel)</span></p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Mevcut Şifre</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    name="current_password"
                    type="password"
                    value={form.current_password}
                    onChange={handleChange}
                    placeholder="Mevcut şifreniz"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Yeni Şifre</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      name="new_password"
                      type="password"
                      value={form.new_password}
                      onChange={handleChange}
                      placeholder="En az 6 karakter"
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Tekrar</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      name="confirm_password"
                      type="password"
                      value={form.confirm_password}
                      onChange={handleChange}
                      placeholder="Şifreyi tekrarla"
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </form>
      </div>
    </div>
  )
}
