import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';


export function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-inner container">
        <Link to={user ? '/dashboard' : '/'} className="navbar-logo">
          <span className="navbar-logo-icon">◈</span>
          SoftSkills
        </Link>

        {user ? (
          <div className="navbar-right">
            <Link to="/dashboard" className={`navbar-link ${isActive('/dashboard') ? 'active' : ''}`}>Главная</Link>
            <Link to="/test" className={`navbar-link ${isActive('/test') ? 'active' : ''}`}>Тест</Link>
            <Link to="/program" className={`navbar-link ${isActive('/program') ? 'active' : ''}`}>Программа</Link>
            <Link to="/recommendations" className={`navbar-link ${isActive('/recommendations') ? 'active' : ''}`}>Материалы</Link>
            <Link to="/methodology" className={`navbar-link ${isActive('/methodology') ? 'active' : ''}`}>Методология</Link>
            {isAdmin && (
              <Link to="/admin" className={`navbar-link navbar-admin ${isActive('/admin') ? 'active' : ''}`}>⚙️ Админ</Link>
            )}
            {!user.has_paid && (
              <Link to="/payment" className="navbar-upgrade">Получить доступ</Link>
            )}
            <Link to="/profile" className={`navbar-avatar ${isActive('/profile') ? 'active' : ''}`}>
              {user.avatar
                ? <img src={user.avatar} alt="avatar" className="navbar-avatar-img" />
                : (user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase())
              }
            </Link>
            <button onClick={handleLogout} className="navbar-logout">Выйти</button>
          </div>
        ) : (
          <div className="navbar-right">
            <Link to="/login" className="navbar-link">Войти</Link>
            <Link to="/register" className="btn btn-primary" style={{ padding: '9px 20px', fontSize: '14px' }}>Начать бесплатно</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
