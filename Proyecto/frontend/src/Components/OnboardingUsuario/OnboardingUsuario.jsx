import { useState, useEffect } from 'react';
import axios from 'axios';
import './OnboardingUsuario.css';

// Importamos las fotos
import foto1 from './Avatares/foto1.jpg';
import foto2 from './Avatares/foto2.jpg';
import foto3 from './Avatares/foto3.jpg';
import foto4 from './Avatares/foto4.jpg';
import foto5 from './Avatares/foto5.jpg';
import foto6 from './Avatares/foto6.jpg';
import foto7 from './Avatares/foto7.jpg';
import foto8 from './Avatares/foto8.jpg';
import foto9 from './Avatares/foto9.jpg';

export default function OnboardingUsuario({ finalizarOnboarding, usuarioId }) {
  const [paso, setPaso] = useState(1);
  const [fotoSeleccionada, setFotoSeleccionada] = useState(null);
  const [calle, setCalle] = useState('');
  const [codigoId, setCodigoId] = useState('');

  const fotos = [foto1, foto2, foto3, foto4, foto5, foto6, foto7, foto8, foto9];
  const calles = [
    "Avenida Siempreviva", "Calle Falsa 123", "Calle Cooper", 
    "Calle Roble", "Avenida de los Gobernadores", "Calle Mammon", 
    "Autopista Matlock", "Calle de la Piruleta", "Paseo del Olor a Pescado"
  ];

  useEffect(() => {
    if (paso === 3 && !codigoId) {
      const numAleatorio = Math.floor(1000 + Math.random() * 9000);
      setCodigoId(`BE-7G-${numAleatorio}`);
    }
  }, [paso, codigoId]);

  const siguientePaso = () => setPaso(paso + 1);

  const guardarEnBaseDeDatos = async () => {
    try {
      // Ajustado para coincidir con la estructura del servidor (datos_onboarding)
      await axios.post('http://localhost:3000/usuarios/completar-onboarding', {
        usuario_id: usuarioId,
        datos_onboarding: {
            avatar_path: fotoSeleccionada,
            calle: calle,
            codigo_contrato: codigoId
        }
      });

      finalizarOnboarding({
        avatar: fotoSeleccionada,
        calle: calle,
        codigo: codigoId
      });
    } catch (error) {
      console.error("Error al guardar onboarding en BD:", error);
      alert("Error al sincronizar con el servidor. Revisa la consola.");
    }
  };

  return (
    <div className="layout-onboarding">
      <div className="overlay-energia"></div>
      <div className="card-onboarding">
        <div className="barra-progreso">
          <div className="progreso-fill" style={{ width: `${(paso / 3) * 100}%` }}></div>
        </div>

        {paso === 1 && (
          <div className="step-container">
            <h2>PASO 1: IDENTIDAD VISUAL</h2>
            <p>Seleccione su unidad de reconocimiento facial:</p>
            <div className="grid-avatares">
              {fotos.map((foto, index) => (
                <div key={index} className={`avatar-item ${fotoSeleccionada === foto ? 'selected' : ''}`} onClick={() => setFotoSeleccionada(foto)}>
                  <img src={foto} alt={`Avatar ${index + 1}`} />
                </div>
              ))}
            </div>
            <button className="btn-next" disabled={!fotoSeleccionada} onClick={siguientePaso}>CONFIRMAR IDENTIDAD</button>
          </div>
        )}

        {paso === 2 && (
          <div className="step-container">
            <h2>PASO 2: SECTOR DE SUMINISTRO</h2>
            <p>¿En qué zona de Springfield reside?</p>
            <select className="select-calle" value={calle} onChange={(e) => setCalle(e.target.value)}>
              <option value="">Seleccione una calle...</option>
              {calles.map((c, i) => <option key={i} value={c}>{c}</option>)}
            </select>
            <button className="btn-next" disabled={!calle} onClick={siguientePaso}>ACEPTAR Y VINCULAR</button>
          </div>
        )}

        {paso === 3 && (
          <div className="step-container success-step">
            <div className="check-animado">✓</div>
            <h2>¡ALTA COMPLETADA!</h2>
            <p>Bienvenido a la red de Burns Energy.</p>
            <div className="id-card">
              <span>CÓDIGO DE OPERADOR ÚNICO:</span>
              <h1 className="codigo-id">{codigoId}</h1>
            </div>
            <button className="btn-finish" onClick={guardarEnBaseDeDatos}>ENTRAR AL TERMINAL</button>
          </div>
        )}
      </div>
    </div>
  );
}