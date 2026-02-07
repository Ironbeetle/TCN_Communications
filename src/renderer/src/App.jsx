import { useState, useEffect } from 'react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import AdminDashboard from './components/AdminDashboard'
import StaffAdminDashboard from './components/StaffAdminDashboard'

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
  const isAdmin = user.role === 'ADMIN' || user.role === 'CHIEF_COUNCIL'
  const isStaffAdmin = user.role === 'STAFF_ADMIN'
  
  // Admin gets staff admin dashboard with full access (no department filter)
  if (isAdmin) {
    return <StaffAdminDashboard user={user} onLogout={handleLogout} isFullAdmin={true} />
  }
  
  // Staff Admin gets the staff admin dashboard (filtered to their department)
  if (isStaffAdmin) {
    return <StaffAdminDashboard user={user} onLogout={handleLogout} isFullAdmin={false} />
  }
  
  // Regular staff get the standard dashboard
  return <Dashboard user={user} onLogout={handleLogout} />
}

export default App
