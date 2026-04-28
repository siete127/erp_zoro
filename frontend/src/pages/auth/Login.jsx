import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { notify } from "../../services/notify";
import AuthLayout from "../../layouts/AuthLayout";
import { connectSocket } from "../../services/socket";
import { clearCache as clearPermissionCache } from "../../services/permissionService";

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

      if (token) localStorage.setItem("token", token);
      if (sessionId) localStorage.setItem("sessionId", sessionId);
      if (userData) {
        localStorage.setItem("user", JSON.stringify(userData));
        const normalizedUserId = String(userData.User_Id || userData.id || "").replace(/^\/+|\/+$/g, "");
        if (normalizedUserId) {
          localStorage.setItem("userId", normalizedUserId);
        }
      }

      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      clearPermissionCache();
      connectSocket();

      const displayName = userData?.Username || user || "Usuario";
      notify("Bienvenido", "success", displayName);
      if (userData?.license_warning) {
        notify(userData.license_warning, "info", displayName);
      }

      // Superadmin va a su propio panel
      try {
        const parts = token.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          if (payload?.is_super_admin === true || Number(payload?.rol) === 1) {
            navigate("/superadmin/dashboard");
            return;
          }
        }
      } catch {}
      navigate("/dashboard");
    } catch (err) {
      notify(err?.response?.data?.detail || "Usuario o contrasena incorrectos", "error");
    }
  };

  return (
    <AuthLayout>
      <div className="grid w-full grid-cols-1 overflow-hidden rounded-3xl bg-[#092052] shadow-2xl animate-in fade-in duration-700 md:grid-cols-5">
        <div className="relative hidden flex-col items-start justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 px-10 py-16 text-white md:col-span-2 md:flex">
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
          <div className="relative z-10">
            <h1 className="mb-4 text-4xl font-black tracking-tight">ERP SYSTEM</h1>
            <p className="mb-8 max-w-xs text-lg leading-relaxed text-indigo-100">
              Gestion integral de recursos empresariales con acceso seguro y control total.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-white"></div>
                <span className="text-sm text-indigo-100">Control centralizado</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-white"></div>
                <span className="text-sm text-indigo-100">Seguridad avanzada</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-white"></div>
                <span className="text-sm text-indigo-100">Reportes en tiempo real</span>
              </div>
            </div>
          </div>
          <div className="absolute bottom-8 right-8 flex h-32 w-32 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            <svg className="h-16 w-16 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
        </div>

        <div className="flex items-center justify-center px-8 py-16 sm:px-12 md:col-span-3">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h2 className="mb-2 text-3xl font-bold text-white">Bienvenido</h2>
              <p className="text-sm text-slate-300">Ingresa tus credenciales para continuar</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="username" className="mb-2 block text-sm font-medium text-slate-200">
                  Usuario
                </label>
                <input
                  id="username"
                  type="text"
                  placeholder="Ingresa tu usuario"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  className="w-full rounded-xl border border-slate-400 bg-white px-4 py-3.5 text-slate-900 placeholder-slate-400 transition duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#092052]"
                  required
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-200">
                    Contrasena
                  </label>
                  <a href="/forgot-password" className="text-xs font-medium text-[#e7e8e9] transition hover:text-white">
                    Olvidaste tu contrasena?
                  </a>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Ingresa tu contrasena"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    className="w-full rounded-xl border border-slate-400 bg-white px-4 py-3.5 pr-12 text-slate-900 placeholder-slate-400 transition duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#092052]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
                    aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                    title={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-5.25 0-9-7-9-7a17.36 17.36 0 012.888-3.725m3.325-2.417A9.953 9.953 0 0112 5c5.25 0 9 7 9 7a17.418 17.418 0 01-1.664 2.344M15 12a3 3 0 11-3-3m0 0L3 3m9 6l9 9"
                        />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3.5 font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:-translate-y-0.5 hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl hover:shadow-indigo-500/40"
              >
                Iniciar sesion
              </button>
            </form>

            <div className="mt-8 border-t border-slate-400 pt-6">
              <p className="text-center text-xs text-slate-300">
                {new Date().getFullYear()} Ardaby Tec SA de CV - Todos los derechos reservados
              </p>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};

export default Login;
