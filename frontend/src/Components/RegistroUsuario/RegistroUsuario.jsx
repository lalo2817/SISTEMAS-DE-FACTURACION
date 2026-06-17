import { useState } from 'react';
import axios from 'axios';
import './RegistroUsuario.css';

import fondoPlanta from '../LoginUsuario/Imagenes/fondo.jpg';
import iconPerfil from '../LoginUsuario/Emoticonos/perfil.png';
import iconCorreo from '../LoginUsuario/Emoticonos/logo de correo.png';
import iconClave from '../LoginUsuario/Emoticonos/logo de contraseña.png';

export default function RegistroUsuario({ irALogin, irAOnboarding }) {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [mostrarClave, setMostrarClave] = useState(false);
  const [paso, setPaso] = useState('formulario'); // 'formulario' | 'verificacion'
  const [codigoIngresado, setCodigoIngresado] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [datosTemp, setDatosTemp] = useState(null);

  const tieneMinimo = clave.length >= 8;
  const tieneMayuscula = /[A-Z]/.test(clave);
  const tieneNumero = /[0-9]/.test(clave);
  const tieneEspecial = /[^A-Za-z0-9]/.test(clave);
  const esClaveSegura = tieneMinimo && tieneMayuscula && tieneNumero && tieneEspecial;

  const generarCodigoContrato = () => {
    const aleatorio = Math.floor(1000 + Math.random() * 9000);
    return 'BE-7G-' + aleatorio;
  };

  // PASO 1: enviar código al correo
  const handleRegistro = async (e) => {
    e.preventDefault();
    if (!esClaveSegura) return;
    setEnviando(true);
    try {
      await axios.post('https://sistemas-de-facturacion-2.onrender.com/auth/enviar-codigo-registro', {
        email: correo,
        nombre
      });
      const codigoContrato = generarCodigoContrato();
      setDatosTemp({ nombre, correo, clave, codigoContrato });
      setPaso('verificacion');
    } catch (error) {
      const msg = error.response?.data?.error;
      alert(msg || 'No se pudo enviar el código. Revisa tu conexión.');
    } finally {
      setEnviando(false);
    }
  };

  // PASO 2: verificar código y crear cuenta
  const handleVerificar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await axios.post('https://sistemas-de-facturacion-2.onrender.com/auth/verificar-codigo', {
        email: datosTemp.correo,
        codigo: codigoIngresado.trim()
      });

      // Código correcto → crear la cuenta
      const res = await axios.post('https://sistemas-de-facturacion-2.onrender.com/usuarios', {
        nombre: datosTemp.nombre,
        email: datosTemp.correo,
        password: datosTemp.clave,
        codigo_contrato: datosTemp.codigoContrato
      });

      if (irAOnboarding) {
        irAOnboarding({
          id: res.data.id,
          nombre: datosTemp.nombre,
          correo: datosTemp.correo,
          codigo: datosTemp.codigoContrato
        });
      }
    } catch (error) {
      const msg = error.response?.data?.error;
      alert(msg || 'Código incorrecto. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const reenviarCodigo = async () => {
    try {
      await axios.post('https://sistemas-de-facturacion-2.onrender.com/auth/enviar-codigo-registro', {
        email: datosTemp.correo,
        nombre: datosTemp.nombre
      });
      alert('Nuevo código enviado a tu correo.');
    } catch (err) {
      alert('Error al reenviar el código.');
    }
  };

  return (
    <div className="layout-login">
      <div className="split-background">
        <div className="bg-purple"></div>
        <div className="bg-white"></div>
      </div>

      <div className="card-login-wrapper">
        <img src={fondoPlanta} alt="Fondo de pantalla" className="bg-pantalla" />
        
        <div className="card-login card-registro-pro">

          {paso === 'formulario' && (
            <>
              <h1 id="login-title">REGISTRO DE NUEVO OPERADOR</h1>
              <form id="form-login" onSubmit={handleRegistro}>
                <div className="input-wrapper">
                  <div className="icon-container"><img src={iconPerfil} alt="User Icon" /></div>
                  <input type="text" placeholder="NOMBRE COMPLETO" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                </div>
                <div className="input-wrapper">
                  <div className="icon-container"><img src={iconCorreo} alt="Email Icon" /></div>
                  <input type="email" placeholder="CORREO ELECTRÓNICO" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
                </div>
                <div className="input-wrapper input-password-container">
                  <div className="icon-container"><img src={iconClave} alt="Lock Icon" /></div>
                  <input type={mostrarClave ? "text" : "password"} placeholder="NUEVA CLAVE" value={clave} onChange={(e) => setClave(e.target.value)} required />
                  <button type="button" className="btn-toggle-eye" onClick={() => setMostrarClave(!mostrarClave)}>
                    {mostrarClave ? "🔒" : "👁️"}
                  </button>
                </div>
                <div className="panel-seguridad">
                  <p className="titulo-seguridad">Protocolo de Seguridad del Reactor:</p>
                  <ul>
                    <li className={tieneMinimo ? "valido" : "invalido"}>{tieneMinimo ? "✓" : "✗"} Mínimo 8 caracteres</li>
                    <li className={tieneMayuscula ? "valido" : "invalido"}>{tieneMayuscula ? "✓" : "✗"} Al menos una mayúscula</li>
                    <li className={tieneNumero ? "valido" : "invalido"}>{tieneNumero ? "✓" : "✗"} Al menos un número</li>
                    <li className={tieneEspecial ? "valido" : "invalido"}>{tieneEspecial ? "✓" : "✗"} Un signo especial</li>
                  </ul>
                </div>
                <button type="submit" className={'btn-submit-epic ' + (!esClaveSegura ? 'btn-deshabilitado' : '')} disabled={!esClaveSegura || enviando}>
                  {enviando ? 'ENVIANDO CÓDIGO...' : 'CREAR OPERADOR'}
                </button>
                <div className="action-links">
                  <a href="#login" onClick={(e) => { e.preventDefault(); if (irALogin) irALogin(); }}>
                    ¿YA TIENES CUENTA?<br />INICIA SESIÓN AQUÍ
                  </a>
                </div>
              </form>
            </>
          )}

          {paso === 'verificacion' && (
            <>
              <h1 id="login-title">VERIFICACIÓN DE IDENTIDAD</h1>
              <p style={{ textAlign: 'center', color: '#aaa', fontSize: '0.9rem', marginBottom: '20px' }}>
                Enviamos un código de 6 dígitos a<br />
                <strong style={{ color: '#00f5d4' }}>{datosTemp?.correo}</strong>
              </p>
              <form id="form-login" onSubmit={handleVerificar}>
                <div className="input-wrapper">
                  <div className="icon-container"><img src={iconClave} alt="Codigo" /></div>
                  <input
                    type="text"
                    placeholder="INGRESA EL CÓDIGO"
                    value={codigoIngresado}
                    onChange={(e) => setCodigoIngresado(e.target.value)}
                    maxLength={6}
                    required
                    style={{ letterSpacing: '6px', fontSize: '1.2rem', textAlign: 'center' }}
                  />
                </div>
                <button type="submit" className="btn-submit-epic" disabled={enviando}>
                  {enviando ? 'VERIFICANDO...' : 'CONFIRMAR CÓDIGO'}
                </button>
                <div className="action-links">
                  <a href="#" onClick={(e) => { e.preventDefault(); reenviarCodigo(); }}>
                    ¿No recibiste el código? Reenviar
                  </a>
                  <br />
                  <a href="#" onClick={(e) => { e.preventDefault(); setPaso('formulario'); }}>
                    ← Volver al registro
                  </a>
                </div>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}