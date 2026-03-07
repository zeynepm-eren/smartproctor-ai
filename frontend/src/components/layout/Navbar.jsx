/**
 * SmartProctor - Navigasyon Çubuğu
 * Rol bazlı menü öğeleri ve bildirim rozeti.
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { notificationAPI } from '../../services/api'
import { Shield, Bell, LogOut, Menu, X } from 'lucide-react'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [notifications, setNotifications] = useState([])
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    notificationAPI.list().then((res) => setNotifications(res.data)).catch(() => {})
  }, [location.pathname])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Rol bazlı menü
  const menuItems = {
    student: [
      { label: 'Sınavlarım', path: '/student' },
      { label: 'Geçmiş', path: '/student/history' },
    ],
    instructor: [
      { label: 'Dersler', path: '/instructor' },
      { label: 'Sınavlar', path: '/instructor/exams' },
      { label: 'Gözetmen Ata', path: '/instructor/proctors' },
      { label: 'Uyuşmazlıklar', path: '/instructor/conflicts' },
    ],
    proctor: [
      { label: 'İncelemeler', path: '/proctor' },
    ],
  }

  const items = menuItems[user?.role] || []
  const roleLabel = { student: 'Öğrenci', instructor: 'Eğitmen', proctor: 'Gözetmen' }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Sol: Logo + Menü */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <Shield className="w-8 h-8 text-blue-600" />
              <span className="font-bold text-lg text-gray-900 hidden sm:block">SmartProctor</span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    location.pathname === item.path
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Sağ: Bildirim + Profil */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <button className="relative p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.first_name} {user?.last_name}</p>
                <p className="text-xs text-gray-500">{roleLabel[user?.role]}</p>
              </div>
              <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
                <LogOut size={20} />
              </button>
            </div>

            {/* Mobile Menu Toggle */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-gray-600">
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 py-3 space-y-1">
          {items.map((item) => (
            <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">
              {item.label}
            </Link>
          ))}
          <button onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50">
            Çıkış Yap
          </button>
        </div>
      )}
    </nav>
  )
}
