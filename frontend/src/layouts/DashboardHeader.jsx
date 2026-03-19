import React, { useState, useEffect } from "react";
import { FaDoorOpen } from "react-icons/fa";

export default function DashboardHeader({ title, onLogout, menuOpen, onToggleMenu }) {
  const [userName, setUserName] = useState('');
  const [greeting, setGreeting] = useState('');

  const greetings = [
    '¡Hola',
    '¡Qué gusto verte',
    '¡Bienvenido',
    '¡Excelente verte',
    '¡Hola, que tengas un gran día',
  ];

  useEffect(() => {
    // Obtener el nombre del usuario del localStorage
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        // Usar Username como el nombre principal
        const name = userData.Username || userData.Name || userData.FirstName || userData.FullName || 'Usuario';
        setUserName(name);
      } catch (e) {
        setUserName('Usuario');
      }
    }

    // Seleccionar un saludo aleatorio
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    setGreeting(randomGreeting);
  }, []);

  return (
    <header className="bg-[#092052] shadow-md py-3 px-4 md:px-8 flex items-center justify-between sticky top-0 z-50 border-b border-[#092052]">
      
      <div className="flex items-center gap-3">
        {/* Botón menú */}
        <button
          onClick={onToggleMenu}
          className="flex items-center justify-center h-10 w-10 rounded-lg border border-[#e7e8e9] text-[#e7e8e9] hover:bg-[#0d2a63] transition"
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
        >
          <span className="sr-only">Abrir menú</span>
          <div className="flex flex-col gap-1">
            <span className="h-0.5 w-5 bg-[#e7e8e9] rounded"></span>
            <span className="h-0.5 w-5 bg-[#e7e8e9] rounded"></span>
            <span className="h-0.5 w-5 bg-[#e7e8e9] rounded"></span>
          </div>
          
        </button>
      </div>

      {/* Centro - Saludo con nombre del usuario */}
      <div className="hidden md:flex items-center justify-center flex-1 mx-4">
        <p className="text-sm md:text-base text-[#e7e8e9] font-semibold truncate">
          {greeting} {userName}!
        </p>
      </div>

      {/* Logout */}
      {onLogout && (
       <button
  onClick={onLogout}
  className="flex items-center justify-center h-10 w-10 rounded-lg bg-red-600 border border-red-600 text-white hover:bg-red-700 transition"
>
  <FaDoorOpen size={20} />
</button>

      )}
    </header>
  );
}
