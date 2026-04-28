import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { useChat } from '../../hooks/useChat';
import { setChatSocket } from '../../services/chatSocket';
import { socket } from '../../services/socket';
import { getApiOrigin } from '../../services/runtimeConfig';
import { notify } from '../../services/notify';

// ─── constantes ────────────────────────────────────────────────────────────
const API_BASE = getApiOrigin();

const TIPO_ICON = { imagen: '🖼️', archivo: '📎', texto: '' };

function fmtHora(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function fmtFecha(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

function Avatar({ nombre = '', size = 9 }) {
  const initials = nombre.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-rose-500', 'bg-amber-500', 'bg-teal-500'];
  const color = colors[(initials.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`w-${size} h-${size} rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
      {initials || '?'}
    </div>
  );
}

// ─── Panel de lista de canales ──────────────────────────────────────────────
function ListaCanales({
  canales,
  canalActivo,
  onSelect,
  onNuevoDirecto,
  onNuevoGrupo,
  onAceptarInvitacion,
  onlineUsers,
  noLeidos,
  invitaciones = [],
}) {
  const [tab, setTab] = useState('chats'); // 'chats' | 'contactos' | 'grupos'
  const [contactos, setContactos] = useState([]);
  const [busqueda, setBusqueda] = useState('');

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const companyId = user?.Company_Id || user?.companies?.[0] || 1;

  useEffect(() => {
    if (tab !== 'contactos') return;
    api.get(`/chat/contactos?company_id=${companyId}`)
      .then(r => setContactos(r.data || []))
      .catch(() => setContactos([]));
  }, [tab, companyId]);

  const filtrarCanales = (lista) => {
    if (!busqueda) return lista;
    return lista.filter(c => (c.Nombre || '').toLowerCase().includes(busqueda.toLowerCase()));
  };

  const filtrarContactos = (lista) => {
    if (!busqueda) return lista;
    const q = busqueda.toLowerCase();
    return lista.filter(c =>
      (c.NombreCompleto || '').toLowerCase().includes(q) ||
      (c.Email || '').toLowerCase().includes(q)
    );
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200" style={{ width: 300 }}>
      {/* Header */}
      <div className="bg-[#092052] px-4 py-3 flex items-center justify-between">
        <span className="text-white font-bold text-base">Mensajes</span>
        <div className="flex gap-2">
          <button
            onClick={onNuevoGrupo}
            title="Nuevo grupo"
            className="text-white/80 hover:text-white text-lg px-1"
          >⊕</button>
        </div>
      </div>

      {/* Buscador */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar..."
          className="w-full bg-white border border-gray-200 rounded-full px-3 py-1.5 text-sm outline-none focus:border-blue-400"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[['chats', 'Chats'], ['contactos', 'Contactos'], ['grupos', 'Grupos']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-xs font-semibold transition ${tab === key ? 'border-b-2 border-[#092052] text-[#092052]' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'chats' && (
          <>
            {filtrarCanales(canales).length === 0 && (
              <p className="text-xs text-gray-400 text-center mt-8 px-4">
                Sin conversaciones.<br />Ve a Contactos para iniciar un chat.
              </p>
            )}
            {filtrarCanales(canales).map(canal => {
              const isActive = canalActivo?.Canal_Id === canal.Canal_Id;
              const unread = noLeidos[canal.Canal_Id] || 0;
              const online = onlineUsers.has(String(canal.OtroUserId));
              return (
                <button
                  key={canal.Canal_Id}
                  onClick={() => onSelect(canal)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition border-b border-gray-100 text-left ${isActive ? 'bg-blue-50' : ''}`}
                >
                  <div className="relative">
                    <Avatar nombre={canal.Nombre} />
                    {online && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800 truncate">{canal.Nombre}</span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">{fmtFecha(canal.FechaUltimoMensaje)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-gray-500 truncate">
                        {TIPO_ICON[canal.TipoUltimoMensaje]}{' '}
                        {canal.UltimoMensaje ? canal.UltimoMensaje.slice(0, 35) : 'Sin mensajes'}
                      </span>
                      {unread > 0 && (
                        <span className="ml-1 bg-green-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 flex-shrink-0">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        )}

        {tab === 'contactos' && (
          <>
            <button
              onClick={onNuevoGrupo}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-100 text-left"
            >
              <div className="w-9 h-9 rounded-full bg-[#092052] flex items-center justify-center text-white text-lg flex-shrink-0">+</div>
              <span className="text-sm font-semibold text-[#092052]">Nuevo grupo</span>
            </button>
            {filtrarContactos(contactos).map(c => {
              const online = onlineUsers.has(String(c.User_Id));
              return (
                <button
                  key={c.User_Id}
                  onClick={() => {
                    Promise.resolve(onNuevoDirecto(c))
                      .then(() => setTab('chats'))
                      .catch(() => {});
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-100 text-left"
                >
                  <div className="relative">
                    <Avatar nombre={c.NombreCompleto} />
                    {online && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{c.NombreCompleto}</p>
                    <p className="text-xs text-gray-400 truncate">{c.RolName || c.Email || ''}</p>
                  </div>
                </button>
              );
            })}
            {filtrarContactos(contactos).length === 0 && (
              <p className="text-xs text-gray-400 text-center mt-8">Sin contactos en esta empresa.</p>
            )}
          </>
        )}

        {tab === 'grupos' && (
          <>
            {invitaciones.length > 0 && (
              <div className="border-b border-gray-100 bg-amber-50/60 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 mb-2">
                  Invitaciones pendientes
                </p>
                <div className="space-y-2">
                  {invitaciones.map((inv) => (
                    <div
                      key={`inv-${inv.Canal_Id}`}
                      className="rounded-lg border border-amber-200 bg-white px-3 py-2"
                    >
                      <p className="text-sm font-semibold text-gray-800 truncate">{inv.Nombre}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {inv.CreadoPorNombre || 'Usuario'} te invito
                      </p>
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={() => onAceptarInvitacion?.(inv)}
                          className="rounded-md bg-[#092052] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0d3a7a]"
                        >
                          Aceptar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filtrarCanales(canales.filter(c => c.Tipo === 'grupo' || c.Tipo === 'empresa')).map(canal => {
              const isActive = canalActivo?.Canal_Id === canal.Canal_Id;
              const unread = noLeidos[canal.Canal_Id] || 0;
              return (
                <button
                  key={canal.Canal_Id}
                  onClick={() => onSelect(canal)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-100 text-left ${isActive ? 'bg-blue-50' : ''}`}
                >
                  <div className="w-9 h-9 rounded-full bg-purple-500 flex items-center justify-center text-white text-base flex-shrink-0">
                    {canal.Tipo === 'empresa' ? '🏢' : '👥'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800 truncate">{canal.Nombre}</span>
                      {unread > 0 && (
                        <span className="bg-green-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{canal.UltimoMensaje || 'Sin mensajes'}</p>
                  </div>
                </button>
              );
            })}
            {filtrarCanales(canales.filter(c => c.Tipo === 'grupo' || c.Tipo === 'empresa')).length === 0 && (
              <p className="text-xs text-gray-400 text-center mt-8">Sin grupos aún.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Área de mensajes ───────────────────────────────────────────────────────
function AreaMensajes({ canal, socket, onlineUsers, miUserId }) {
  const { mensajes, loading, typing, enviar, notificarEscritura, cargarMas } = useChat(socket, canal?.Canal_Id);
  const [texto, setTexto] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [preview, setPreview] = useState(null); // { url, nombre, tipo }
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  const handleEnviar = () => {
    const contenido = texto.trim();
    if (!contenido && !preview) return;

    enviar({
      contenido,
      tipo: preview?.tipo || 'texto',
      archivoUrl: preview?.url || null,
      archivoNombre: preview?.nombre || null,
    });

    setTexto('');
    setPreview(null);
    notificarEscritura(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  };

  const handleTextoChange = (e) => {
    setTexto(e.target.value);
    notificarEscritura(e.target.value.length > 0);
    // auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/chat/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview({ url: res.data.url, nombre: res.data.nombre, tipo: res.data.tipo, mime: res.data.mime });
    } catch {
      alert('Error al subir el archivo');
    } finally {
      setSubiendo(false);
      e.target.value = '';
    }
  };

  const isOnline = canal?.OtroUserId ? onlineUsers.has(String(canal.OtroUserId)) : false;

  if (!canal) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
        <div className="text-5xl mb-3">💬</div>
        <p className="text-sm font-medium">Selecciona una conversación</p>
        <p className="text-xs mt-1">o inicia una nueva desde Contactos</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#efeae2]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23d4d4d4\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}>
      {/* Header del canal */}
      <div className="bg-[#092052] px-4 py-3 flex items-center gap-3 flex-shrink-0">
        {canal.Tipo === 'empresa' ? (
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-lg">🏢</div>
        ) : canal.Tipo === 'grupo' ? (
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-lg">👥</div>
        ) : (
          <div className="relative">
            <Avatar nombre={canal.Nombre} />
            {isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-[#092052] rounded-full" />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{canal.Nombre}</p>
          <p className="text-white/60 text-xs">
            {canal.Tipo === 'directo'
              ? (isOnline ? 'En línea' : 'Desconectado')
              : canal.Tipo === 'empresa' ? 'Canal general de empresa'
              : 'Grupo'}
          </p>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {loading && <p className="text-xs text-center text-gray-400 py-4">Cargando mensajes...</p>}

        {mensajes.length > 0 && (
          <button
            onClick={cargarMas}
            className="w-full text-xs text-blue-600 hover:underline text-center py-1"
          >
            Cargar mensajes anteriores
          </button>
        )}

        {(() => {
          let lastDate = null;
          return mensajes.map((msg) => {
            const esMio = Number(msg.User_Id) === Number(miUserId);
            const fecha = fmtFecha(msg.FechaEnvio);
            const showDate = fecha !== lastDate;
            lastDate = fecha;

            return (
              <React.Fragment key={msg.Mensaje_Id}>
                {showDate && (
                  <div className="flex justify-center my-2">
                    <span className="bg-white/80 text-gray-500 text-xs px-3 py-1 rounded-full shadow-sm">{fecha}</span>
                  </div>
                )}
                <div className={`flex ${esMio ? 'justify-end' : 'justify-start'} mb-1`}>
                  {!esMio && canal.Tipo !== 'directo' && (
                    <Avatar nombre={msg.RemitenteNombre || ''} size={7} />
                  )}
                  <div
                    className={`max-w-xs lg:max-w-md xl:max-w-lg rounded-xl px-3 py-2 shadow-sm relative ${
                      esMio ? 'bg-[#d9fdd3] ml-2 rounded-tr-none' : 'bg-white mr-2 rounded-tl-none'
                    }`}
                  >
                    {/* Nombre remitente en grupos */}
                    {!esMio && (canal.Tipo === 'grupo' || canal.Tipo === 'empresa') && (
                      <p className="text-xs font-semibold text-blue-600 mb-0.5">{msg.RemitenteNombre}</p>
                    )}

                    {/* Contenido */}
                    {msg.TipoContenido === 'imagen' && msg.ArchivoUrl ? (
                      <a href={`${API_BASE}${msg.ArchivoUrl}`} target="_blank" rel="noreferrer">
                        <img
                          src={`${API_BASE}${msg.ArchivoUrl}`}
                          alt={msg.ArchivoNombre || 'imagen'}
                          className="rounded-lg max-w-full max-h-48 object-cover mb-1 cursor-pointer hover:opacity-90"
                        />
                      </a>
                    ) : msg.TipoContenido === 'archivo' && msg.ArchivoUrl ? (
                      <a
                        href={`${API_BASE}${msg.ArchivoUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 mb-1"
                      >
                        <span className="text-xl">📎</span>
                        <span className="truncate max-w-[160px]">{msg.ArchivoNombre || 'Archivo'}</span>
                      </a>
                    ) : null}

                    {msg.Contenido && (
                      <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{msg.Contenido}</p>
                    )}

                    <span className={`text-[10px] text-gray-400 float-right ml-2 mt-0.5 ${esMio ? '' : ''}`}>
                      {fmtHora(msg.FechaEnvio)}
                      {esMio && <span className="ml-1 text-blue-400">✓✓</span>}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          });
        })()}

        {typing && (
          <div className="flex justify-start">
            <div className="bg-white rounded-xl px-4 py-2 shadow-sm text-xs text-gray-500 italic">escribiendo...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Preview de archivo antes de enviar */}
      {preview && (
        <div className="mx-4 mb-2 flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
          {preview.tipo === 'imagen' ? (
            <img src={`${API_BASE}${preview.url}`} alt="preview" className="h-12 w-12 object-cover rounded" />
          ) : (
            <span className="text-2xl">📎</span>
          )}
          <span className="text-sm text-gray-700 truncate flex-1">{preview.nombre}</span>
          <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-red-500 text-lg">×</button>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-3 py-2 flex items-end gap-2 flex-shrink-0">
        <input ref={fileRef} type="file" className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={handleFileChange} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={subiendo}
          title="Adjuntar archivo o foto"
          className="text-gray-500 hover:text-[#092052] text-xl p-1 flex-shrink-0 disabled:opacity-40"
        >
          {subiendo ? '⏳' : '📎'}
        </button>
        <button
          onClick={() => { fileRef.current.accept = 'image/*'; fileRef.current?.click(); }}
          disabled={subiendo}
          title="Enviar foto"
          className="text-gray-500 hover:text-[#092052] text-xl p-1 flex-shrink-0 disabled:opacity-40"
        >
          📷
        </button>
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={handleTextoChange}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje"
          rows={1}
          className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 text-sm outline-none resize-none max-h-28 min-h-[2.25rem] leading-normal"
          style={{ height: '2.25rem' }}
        />
        <button
          onClick={handleEnviar}
          disabled={!texto.trim() && !preview}
          className="bg-[#092052] text-white rounded-full w-9 h-9 flex items-center justify-center text-lg flex-shrink-0 disabled:bg-gray-300 hover:bg-[#0d3a7a] transition"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

// ─── Modal Nuevo Grupo ──────────────────────────────────────────────────────
function ModalNuevoGrupo({ onClose, onCreado }) {
  const [nombre, setNombre] = useState('');
  const [contactos, setContactos] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [loading, setLoading] = useState(false);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const companyId = user?.Company_Id || user?.companies?.[0] || 1;

  useEffect(() => {
    api.get(`/chat/contactos?company_id=${companyId}`)
      .then(r => setContactos(r.data || []))
      .catch(() => {});
  }, [companyId]);

  const toggle = (id) => setSeleccionados(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const crear = async () => {
    if (!nombre.trim()) { alert('Escribe el nombre del grupo'); return; }
    setLoading(true);
    try {
      const res = await api.post('/chat/canales/grupo', {
        nombre,
        invitados: seleccionados,
        company_id: companyId,
      });
      onCreado(res.data);
    } catch { alert('Error al crear grupo'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Nuevo grupo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-5 space-y-3">
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Nombre del grupo *"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
          />
          <p className="text-xs font-semibold text-gray-500 mt-2">Agregar participantes</p>
          <div className="max-h-52 overflow-y-auto space-y-1 border rounded-lg p-2">
            {contactos.map(c => (
              <label key={c.User_Id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded p-1">
                <input
                  type="checkbox"
                  checked={seleccionados.includes(c.User_Id)}
                  onChange={() => toggle(c.User_Id)}
                  className="accent-[#092052]"
                />
                <Avatar nombre={c.NombreCompleto} size={7} />
                <span className="text-sm text-gray-700">{c.NombreCompleto}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancelar</button>
          <button
            onClick={crear}
            disabled={loading}
            className="px-4 py-2 text-sm bg-[#092052] text-white rounded hover:bg-[#0d3a7a] disabled:opacity-50"
          >
            {loading ? 'Creando...' : 'Crear grupo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ChatDrawer principal ───────────────────────────────────────────────────
export default function ChatDrawer({ isOpen, onClose }) {
  const [canales, setCanales] = useState([]);
  const [canalActivo, setCanalActivo] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [noLeidos, setNoLeidos] = useState({});
  const [invitaciones, setInvitaciones] = useState([]);
  const [showNuevoGrupo, setShowNuevoGrupo] = useState(false);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const miUserId = user?.User_Id || user?.id;
  const companyId = user?.Company_Id || user?.companies?.[0] || 1;

  // Conectar socket
  useEffect(() => {
    setChatSocket(socket);
  }, []);

  // Escuchar eventos globales del socket para badges y presencia
  useEffect(() => {
    if (!socket) return;

    const onStatus = ({ userId, online }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        online ? next.add(String(userId)) : next.delete(String(userId));
        return next;
      });
    };

    const onNotif = ({ canal_id, mensaje }) => {
      if (!isOpen || canalActivo?.Canal_Id !== canal_id) {
        setNoLeidos(prev => ({ ...prev, [canal_id]: (prev[canal_id] || 0) + 1 }));

        const remitente = String(mensaje?.RemitenteNombre || '').trim();
        const contenido = String(mensaje?.Contenido || '').trim();
        const texto = contenido || (
          mensaje?.TipoContenido === 'imagen'
            ? 'Te envio una imagen'
            : mensaje?.TipoContenido === 'archivo'
              ? 'Te envio un archivo'
              : 'Tienes un mensaje nuevo'
        );
        notify.info(remitente ? `${remitente}: ${texto}` : texto);
      }
      // Refrescar lista de canales para actualizar último mensaje
      cargarCanales();
    };

    const onMensaje = (msg) => {
      // Si llega un mensaje de un canal que no está en la lista, recargar
      cargarCanales();
    };

    socket.on('user_status', onStatus);
    socket.on('chat:notif', onNotif);
    socket.on('chat:mensaje', onMensaje);

    return () => {
      socket.off('user_status', onStatus);
      socket.off('chat:notif', onNotif);
      socket.off('chat:mensaje', onMensaje);
    };
  }, [socket, isOpen, canalActivo]);

  const asegurarCanalEmpresa = useCallback(async () => {
    try {
      await api.post('/chat/canales/empresa', { company_id: companyId });
    } catch {
      // silencioso
    }
  }, [companyId]);

  const cargarInvitaciones = useCallback(async () => {
    try {
      const res = await api.get('/chat/canales/invitaciones');
      setInvitaciones(res.data || []);
    } catch {
      setInvitaciones([]);
    }
  }, []);

  const cargarCanales = useCallback(async () => {
    try {
      await asegurarCanalEmpresa();
      const res = await api.get(`/chat/canales?company_id=${companyId}`);
      const lista = res.data || [];
      setCanales(lista);

      // Actualizar badges de no leídos desde el servidor
      const badges = {};
      lista.forEach(c => { if (c.NoLeidos > 0) badges[c.Canal_Id] = c.NoLeidos; });
      setNoLeidos(badges);
    } catch { /* silencioso */ }
  }, [asegurarCanalEmpresa, companyId]);

  useEffect(() => {
    if (!isOpen) return;

    cargarCanales();
    cargarInvitaciones();
  }, [isOpen, cargarCanales, cargarInvitaciones]);

  // Al abrir canal — limpiar badge
  const handleSelectCanal = (canal) => {
    setCanalActivo(canal);
    setNoLeidos(prev => ({ ...prev, [canal.Canal_Id]: 0 }));
  };

  // Iniciar chat directo con un contacto
  const handleNuevoDirecto = async (contacto) => {
    try {
      const res = await api.post('/chat/canales/directo', {
        other_user_id: contacto.User_Id,
        company_id: companyId,
      });
      await cargarCanales();
      setCanalActivo({ ...res.data, Nombre: contacto.NombreCompleto, OtroUserId: contacto.User_Id });
    } catch { alert('Error al abrir chat'); }
  };

  const handleGrupoCreado = async (canal) => {
    setShowNuevoGrupo(false);
    await cargarCanales();
    setCanalActivo(canal);
  };

  const handleAceptarInvitacion = async (invitacion) => {
    if (!invitacion?.Canal_Id) return;

    try {
      await api.post(`/chat/canales/${invitacion.Canal_Id}/aceptar`);
      const canal = await api.get(`/chat/canales/${invitacion.Canal_Id}`);
      await cargarCanales();
      await cargarInvitaciones();
      setCanalActivo(canal.data);
      notify.success(`Te uniste a ${invitacion.Nombre || 'el grupo'}`);
    } catch {
      notify.error('No se pudo aceptar la invitacion');
    }
  };

  // Badge total para el header
  const totalNoLeidos = Object.values(noLeidos).reduce((a, b) => a + b, 0);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex shadow-2xl" style={{ width: 'min(700px, 100vw)' }}>
        {/* Lista de canales */}
        <ListaCanales
          canales={canales}
          canalActivo={canalActivo}
          onSelect={handleSelectCanal}
          onNuevoDirecto={handleNuevoDirecto}
          onNuevoGrupo={() => setShowNuevoGrupo(true)}
          onAceptarInvitacion={handleAceptarInvitacion}
          onlineUsers={onlineUsers}
          noLeidos={noLeidos}
          invitaciones={invitaciones}
        />

        {/* Área de mensajes */}
        <AreaMensajes
          canal={canalActivo}
          socket={socket}
          onlineUsers={onlineUsers}
          miUserId={miUserId}
        />
      </div>

      {showNuevoGrupo && (
        <ModalNuevoGrupo
          onClose={() => setShowNuevoGrupo(false)}
          onCreado={handleGrupoCreado}
        />
      )}
    </>
  );
}

// Exportamos el total de no leídos para el badge del header
export function useChatBadge(isOpen) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!socket) return;

    const onNotif = () => {
      if (!isOpen) setTotal(prev => prev + 1);
    };

    socket.on('chat:notif', onNotif);
    return () => socket.off('chat:notif', onNotif);
  }, [socket, isOpen]);

  const clear = () => setTotal(0);
  return { total, clear };
}
