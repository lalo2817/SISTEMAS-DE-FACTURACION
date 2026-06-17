import { useState } from 'react';
import axios from 'axios';

// Componentes (mantén tus importaciones tal cual)
import LoginUsuario from './Components/LoginUsuario/LoginUsuario';
import RegistroUsuario from './Components/RegistroUsuario/RegistroUsuario';
import LoginAdmin from './Components/LoginAdmin/LoginAdmin';
import OnboardingUsuario from './Components/OnboardingUsuario/OnboardingUsuario';
import DashboardCliente from './Components/DashboardCliente/DashboardCliente';
import DashboardAdmin from './Components/DashboardAdmin'; 
import DashboardBurns from './Components/DashboardBurns/DashboardBurns'; 

function App() {
  const [pantalla, setPantalla] = useState('login');
  const [rolAdmin, setRolAdmin] = useState(null);
  const [datosUsuario, setDatosUsuario] = useState(null);

  // --- LÓGICA DE SINCRONIZACIÓN ---
  const fetchDatosCompletos = async (id) => {
    // Seguridad: si no hay ID, no intentamos llamar al servidor
    if (!id) {
      console.error("Error: Se intentó sincronizar un usuario sin ID");
      return;
    }

    try {
      const res = await axios.get(`http://localhost:3000/usuarios/${id}`);
      
      // Asignamos el ID original al objeto que viene de BD para mantener consistencia
      setDatosUsuario({ ...res.data, id: id }); 
      setPantalla('dashboard');
    } catch (err) {
      console.error("Error al sincronizar datos:", err);
      alert("Error al cargar perfil del reactor. Verifica la base de datos.");
    }
  };

  // --- MANEJADORES ---
  const manejarLoginExitoso = (datosLogin) => {
    // datosLogin debe traer { id: numero, rol: 'cliente' }
    if (datosLogin.rol === 'asistente' || datosLogin.rol === 'jefe') {
      setRolAdmin(datosLogin.rol);
      setPantalla('dashboardAdmin');
    } else {
      fetchDatosCompletos(datosLogin.id);
    }
  };

  const cerrarSesionTotal = () => {
    setRolAdmin(null);
    setDatosUsuario(null);
    setPantalla('login');
  };

  return (
    <div className="App">
      {pantalla === 'login' && (
        <LoginUsuario 
          irARegistro={() => setPantalla('registro')} 
          irAAdmin={() => setPantalla('admin')}
          alLoguear={manejarLoginExitoso} 
        />
      )}

      {pantalla === 'registro' && (
        <RegistroUsuario 
          irAOnboarding={(datos) => { 
            setDatosUsuario(datos); // Datos básicos iniciales
            setPantalla('onboarding'); 
          }} 
          irALogin={() => setPantalla('login')} 
        />
      )}

      {pantalla === 'onboarding' && (
        <OnboardingUsuario 
          usuarioId={datosUsuario?.id} 
          finalizarOnboarding={() => fetchDatosCompletos(datosUsuario.id)} 
        />
      )}

      {pantalla === 'admin' && (
        <LoginAdmin 
          irALoginUsuario={() => setPantalla('login')} 
          alLoguearAdmin={(rol) => {
            setRolAdmin(rol);
            setPantalla('dashboardAdmin');
          }}
        />
      )}

      {/* Solo renderizamos el dashboard si datosUsuario tiene contenido */}
      {pantalla === 'dashboard' && datosUsuario && (
        <DashboardCliente 
          usuario={datosUsuario}
          irALogin={cerrarSesionTotal} 
        />
      )}

      {pantalla === 'dashboardAdmin' && (
        rolAdmin === 'jefe' ? (
          <DashboardBurns cerrarSesion={cerrarSesionTotal} />
        ) : (
          <DashboardAdmin rol={rolAdmin} cerrarSesion={cerrarSesionTotal} />
        )
      )}
    </div>
  );
}

export default App;