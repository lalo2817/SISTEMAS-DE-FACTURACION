import { useState } from 'react';
import './LoginAdmin.css';

import fondoPlanta from '../LoginUsuario/Imagenes/fondo.jpg';
import iconClave from '../LoginUsuario/Emoticonos/logo de contraseña.png';

export default function LoginAdmin({ irALoginUsuario, alLoguearAdmin }) {
  const [rolSeleccionado, setRolSeleccionado] = useState(null); 
  const [clave, setClave] = useState('');
  const [mostrarClave, setMostrarClave] = useState(false);

  const handleLoginAdmin = (e) => {
    e.preventDefault();
    
    // Si es asistente, enviamos 'asistente'
    if (rolSeleccionado === 'asistente' && clave === '1234') {
      alert('¡Bienvenido, Smithers! Acceso autorizado al Sector 7-G.');
      alLoguearAdmin('asistente'); 
    } 
    // Si es admin, enviamos 'burns' (esto es lo que espera App.js)
    else if (rolSeleccionado === 'admin' && clave === '4321') {
      alert('¡BIENVENIDO, SEÑOR BURNS! Control absoluto iniciado.');
      alLoguearAdmin('jefe');
    } else {
      alert('Código de autenticación incorrecto.');
    }
  };

  return (
    <div className="layout-login">
      <div className="split-background"><div className="bg-purple"></div><div className="bg-white"></div></div>
      <div className="card-login-wrapper">
        <img src={fondoPlanta} alt="Fondo" className="bg-pantalla" />
        <div className="card-login card-admin-pro">
          {!rolSeleccionado ? (
            <>
              <h1 id="login-title">TERMINAL DE CONTROL RESTRINGIDO</h1>
              <p className="subtitulo-admin">Seleccione su jerarquía en la planta nuclear:</p>
              <div className="contenedor-roles">
                <button type="button" className="btn-rol btn-asistente" onClick={() => setRolSeleccionado('asistente')}>
                  <span className="emoji-rol">💼</span> <span className="texto-rol">ASISTENTE</span>
                </button>
                <button type="button" className="btn-rol btn-boss" onClick={() => setRolSeleccionado('admin')}>
                  <span className="emoji-rol">🦅</span> <span className="texto-rol">ADMINISTRADOR</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 id="login-title">{rolSeleccionado === 'asistente' ? 'ACCESO ASISTENTE' : 'ACCESO ALTO MANDO'}</h1>
              <p className="subtitulo-admin indicacion-clave">
                {rolSeleccionado === 'asistente' ? 'Bienvenido Asistente, ingrese la clave:' : 'Señor Burns, ingrese código supremo:'}
              </p>
              <form id="form-login" onSubmit={handleLoginAdmin}>
                <div className="input-wrapper input-password-container">
                  <div className="icon-container"><img src={iconClave} alt="Lock" /></div>
                  <input 
                    type={mostrarClave ? "text" : "password"} 
                    placeholder="CÓDIGO DE ACCESO" 
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    required 
                    autoFocus
                  />
                  <button type="button" className="btn-toggle-eye" onClick={() => setMostrarClave(!mostrarClave)}>
                    {mostrarClave ? "🔒" : "👁️"}
                  </button>
                </div>
                <button type="submit" className="btn-submit-epic btn-ingresar-admin">AUTENTICAR IDENTIDAD</button>
                <button type="button" className="btn-volver-roles" onClick={() => setRolSeleccionado(null)}>← Cambiar de Rol</button>
              </form>
            </>
          )}
          <div className="action-links links-admin">
            <a href="#login-usuario" onClick={(e) => { e.preventDefault(); irALoginUsuario(); }}>VOLVER AL LOGIN DE USUARIOS</a>
          </div>
        </div>
      </div>
    </div>
  );
}