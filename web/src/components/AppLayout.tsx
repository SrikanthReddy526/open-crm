import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { startReminderAlerts } from '../offline/alerts'
import { pendingCount } from '../offline/sync'
import { LanguageSwitcher } from './LanguageSwitcher'
import { SyncIndicator } from './SyncIndicator'

export function AppLayout() {
  const { t } = useTranslation()
  const { user, logout, hasRole } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  // Desktop notification when a reminder falls due (if the user allowed notifications).
  useEffect(() => startReminderAlerts(t('reminders.notifyTitle')), [t])

  async function onLogout() {
    const waiting = await pendingCount()
    if (waiting > 0 && !window.confirm(t('sync.logoutWarning', { count: waiting }))) return
    await logout()
    navigate('/login', { replace: true })
  }

  const links: { to: string; label: string; end?: boolean; show?: boolean }[] = [
    { to: '/', label: t('nav.dashboard'), end: true },
    { to: '/customers', label: t('nav.customers') },
    { to: '/map', label: t('nav.map') },
    { to: '/visits', label: t('nav.visits') },
    { to: '/reminders', label: t('nav.reminders') },
    { to: '/tickets', label: t('nav.tickets') },
    { to: '/leads', label: t('nav.leads') },
    { to: '/deals', label: t('nav.deals') },
    { to: '/admin/users', label: t('nav.users'), show: hasRole('ADMIN') },
    { to: '/admin/devices', label: t('nav.devices'), show: hasRole('ADMIN') },
  ]

  return (
    <div className="app">
      <header className="topbar">
        <button
          type="button"
          className="btn btn-ghost menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="main-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          ☰ <span className="visually-hidden">{t('nav.menu')}</span>
        </button>
        <NavLink to="/" className="brand">
          {t('app.name')}
        </NavLink>
        {/* Clicking any link closes the phone menu */}
        <nav id="main-nav" className={`nav${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)}>
          {links
            .filter((l) => l.show !== false)
            .map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end}>
                {l.label}
              </NavLink>
            ))}
          <NavLink to="/profile" className="nav-profile">
            {t('nav.profile')}
          </NavLink>
        </nav>
        <div className="topbar-right">
          <SyncIndicator />
          <LanguageSwitcher />
          {user && (
            <NavLink to="/profile" className="user-chip" title={user.email}>
              <span className="user-name">{user.fullName}</span>
              <span className="user-role">{t(`roles.${user.role}`)}</span>
            </NavLink>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => void onLogout()}>
            {t('nav.logout')}
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
