import { useState, useEffect } from 'react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import AdminDashboard from './components/AdminDashboard'
import StaffAdminDashboard from './components/StaffAdminDashboard'
import FinanceDashboard from './components/FinanceDashboard'
import DeptDashboard from './components/DeptDashboard'

function App() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing session on app load
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const currentUser = await window.electronAPI.auth.getCurrentUser()
      if (currentUser) {
        setUser(currentUser)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoginSuccess = (userData) => {
    setUser(userData)
  }

  const handleLogout = () => {
    setUser(null)
  }

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  // Not logged in - show login
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />
  }

  // Role-based routing
  const role = user.role

  if (role === 'ADMIN' || role === 'COUNCIL') {
    return <AdminDashboard user={user} onLogout={handleLogout} />
  }

  if (role === 'STAFF_ADMIN') {
    return <StaffAdminDashboard user={user} onLogout={handleLogout} isFullAdmin={false} />
  }

  if (role === 'FINANCE') {
    return <FinanceDashboard user={user} onLogout={handleLogout} />
  }

  if (role === 'DEPARTMENT_ADMIN') {
    return <DeptDashboard user={user} onLogout={handleLogout} />
  }

  // Regular staff get the standard dashboard
  return <Dashboard user={user} onLogout={handleLogout} />
}

export default App
