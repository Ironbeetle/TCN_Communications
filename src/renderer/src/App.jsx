import { useState, useEffect } from 'react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import AdminDashboard from './components/AdminDashboard'

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
  
  return isAdmin ? (
    <AdminDashboard user={user} onLogout={handleLogout} />
  ) : (
    <Dashboard user={user} onLogout={handleLogout} />
  )
}

export default App
