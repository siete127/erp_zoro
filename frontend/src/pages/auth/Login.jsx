import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { notify } from '../../services/notify';
import AuthLayout from "../../layouts/AuthLayout";

const Login = () => {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/auth/login", { username: user, password: pass });
      const { token, sessionId, user: userData } = res.data;
      // store token and session id
      if (token) localStorage.setItem('token', token);
      if (sessionId) localStorage.setItem('sessionId', sessionId);
      if (userData) {
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('userId', userData.User_Id || userData.id);
      }
      // set default auth header for future requests
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Usar Username del usuario
      const displayName = userData?.Username || user || 'Usuario';
      notify('¡Bienvenido Usuario!', 'success', displayName);
      navigate("/dashboard");
    } catch (err) {
      notify('Usuario o contraseña incorrectos', 'error');
    }
  };

  return (
    <AuthLayout>
      <div className="bg-[#092052] dark:bg-[#092052] rounded-3xl shadow-2xl overflow-hidden w-full grid grid-cols-1 md:grid-cols-5 animate-in fade-in duration-700">
      {/* Left panel - visual / branding for desktop */}
      <div className="hidden md:flex md:col-span-2 flex-col justify-center items-start px-10 py-16 bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 text-white relative">
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-black mb-4 tracking-tight">ERP SYSTEM</h1>
          <p className="text-lg text-indigo-100 leading-relaxed max-w-xs mb-8">
            Gestión integral de recursos empresariales con acceso seguro y control total.
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span className="text-sm text-indigo-100">Control centralizado</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span className="text-sm text-indigo-100">Seguridad avanzada</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span className="text-sm text-indigo-100">Reportes en tiempo real</span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-8 right-8 w-32 h-32 bg-white/10 rounded-2xl backdrop-blur-sm flex items-center justify-center">
          <svg className="w-16 h-16 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="md:col-span-3 flex items-center justify-center px-8 sm:px-12 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white dark:text-white mb-2">Bienvenido</h2>
            <p className="text-sm text-slate-300 dark:text-slate-300">Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-200 dark:text-slate-200 mb-2">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                placeholder="Ingresa tu usuario"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl border border-slate-400 dark:border-slate-400 bg-white dark:bg-slate-100 text-slate-900 dark:text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#092052] focus:border-transparent transition duration-200"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-slate-200 dark:text-slate-200">
                  Contraseña
                </label>
                <a 
                  href="/forgot-password" 
                  className="text-xs text-[#e7e8e9] hover:text-white font-medium transition"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ingresa tu contraseña"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className="w-full px-4 py-3.5 pr-12 rounded-xl border border-slate-400 dark:border-slate-400 bg-white dark:bg-slate-100 text-slate-900 dark:text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#092052] focus:border-transparent transition duration-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-slate-700"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.25 0-9-7-9-7a17.36 17.36 0 012.888-3.725m3.325-2.417A9.953 9.953 0 0112 5c5.25 0 9 7 9 7a17.418 17.418 0 01-1.664 2.344M15 12a3 3 0 11-3-3m0 0L3 3m9 6l9 9" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-300 transform hover:-translate-y-0.5"
            >
              Iniciar Sesión
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-400 dark:border-slate-400">
            <p className="text-xs text-center text-slate-300">© {new Date().getFullYear()} Ardaby Tec SA de CV — Todos los derechos reservados</p>
          </div>
        </div>
      </div>
      </div>
    </AuthLayout>
  );
};

export default Login;
