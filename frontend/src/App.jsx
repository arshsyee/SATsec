import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/AuthContext'
import Landing        from './pages/Landing'
import AuditResults   from './pages/AuditResults'
import Dashboard      from './pages/Dashboard'
import Settings       from './pages/Settings'
import Scanning       from './pages/Scanning'
import Live           from './pages/Live'
import NotFound       from './pages/NotFound'
import Features       from './pages/Features'
import Login          from './pages/Login'
import Register       from './pages/Register'
import VerifyOtp      from './pages/VerifyOtp'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword  from './pages/ResetPassword'
import Privacy        from './pages/Privacy'
import Terms          from './pages/Terms'
import ImportAuditsModal from './components/ImportAuditsModal'
import SignOutModal from './components/SignOutModal'
import ThemeSwitcher from './components/ThemeSwitcher'

function GlobalModals() {
  const { showImportModal, pendingImportAudits, dismissImportModal } = useAuth()
  return (
    <>
      <SignOutModal />
      {showImportModal && pendingImportAudits.length > 0 && (
        <ImportAuditsModal
          audits={pendingImportAudits}
          onDone={dismissImportModal}
        />
      )}
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"                element={<Landing />} />
          <Route path="/scanning"        element={<Scanning />} />
          <Route path="/live"            element={<Live />} />
          <Route path="/results"         element={<AuditResults />} />
          <Route path="/dashboard"       element={<Dashboard />} />
          <Route path="/settings"        element={<Settings />} />
          <Route path="/features"        element={<Features />} />
          <Route path="/login"           element={<Login />} />
          <Route path="/register"        element={<Register />} />
          <Route path="/verify-otp"      element={<VerifyOtp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />} />
          <Route path="/privacy"         element={<Privacy />} />
          <Route path="/terms"           element={<Terms />} />
          <Route path="*"                element={<NotFound />} />
        </Routes>
        <GlobalModals />
        <ThemeSwitcher />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
