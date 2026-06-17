import { useState, useEffect } from 'react';
import axios from 'axios';
import './DashboardAdmin.css';

export default function DashboardAdmin({ rol, cerrarSesion }) {
  const [pestanaActiva, setPestanaActiva] = useState('generador');
  const [codigoBusqueda, setCodigoBusqueda] = useState('');
  const [usuariosEncontrados, setUsuariosEncontrados] = useState([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [pagosPendientes, setPagosPendientes] = useState([]);
  const [consumo, setConsumo] = useState({ tv: 0, micro: 0, aire: 0, luces: 0, pc: 0, calefaccion: 0 });

  useEffect(() => {
    const fetchPagos = async () => {
      try {
        const res = await axios.get('http://localhost:3000/admin/pagos-pendientes');
        setPagosPendientes(res.data);
      } catch (err) { console.error(err); }
    };
    fetchPagos();
    const interval = setInterval(fetchPagos, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (codigoBusqueda.length > 1) {
      axios.get(`http://localhost:3000/admin/buscar-cliente/${codigoBusqueda}`)
        .then(res => setUsuariosEncontrados(res.data));
    } else { setUsuariosEncontrados([]); }
  }, [codigoBusqueda]);

  // Lógica: 100 base + consumos
  const precios = { tv: 2.5, micro: 5.0, aire: 15.0, luces: 1.2, pc: 4.5, calefaccion: 20.0 };
  const subtotal = 100 + Object.keys(consumo).reduce((acc, key) => acc + (consumo[key] * precios[key]), 0);
  const notaDebito = subtotal > 300 ? (subtotal * 0.15) : 0;
  const total = subtotal + notaDebito;

  const handleEmitirFactura = async () => {
    try {
      await axios.post('http://localhost:3000/admin/generar-factura', {
        usuario_id: usuarioSeleccionado.id, subtotal, nota_debito: notaDebito, total
      });
      alert("Factura emitida correctamente.");
      setUsuarioSeleccionado(null);
    } catch (err) {
      const msg = err.response?.data?.message;
      alert(msg || "Error al emitir la factura.");
    }
  };

  const handleConfirmarPago = async (factura_id) => {
    try {
      await axios.post(`http://localhost:3000/admin/confirmar-pago/${factura_id}`);
      setPagosPendientes(pagosPendientes.filter(p => p.factura_id !== factura_id));
      alert("Pago confirmado correctamente.");
    } catch (err) {
      console.error(err);
      alert("Error al confirmar el pago.");
    }
  };

  return (
    <div className="admin-dashboard-layout">
      <header className="admin-header">
        <div className="logo-area">
          <h1>BURNS ENERGY INC.</h1>
          <span className="terminal-status">TERMINAL: {rol.toUpperCase()}</span>
        </div>
        {/* BOTÓN SALIR EN ESPAÑOL */}
        <button className="btn-logout" onClick={cerrarSesion}>CERRAR SESIÓN</button>
      </header>

      <nav className="admin-nav-tabs">
        <button className={pestanaActiva === 'generador' ? 'active' : ''} onClick={() => setPestanaActiva('generador')}>FACTURACIÓN</button>
        <button className={pestanaActiva === 'pagos' ? 'active' : ''} onClick={() => setPestanaActiva('pagos')}>PAGOS ({pagosPendientes.length})</button>
      </nav>

      <main className="admin-main-content">
        {pestanaActiva === 'generador' && (
          <div className="admin-card-panel">
            {!usuarioSeleccionado ? (
              <div className="search-box">
                <input placeholder="Buscar cliente por nombre o contrato..." onChange={(e) => setCodigoBusqueda(e.target.value)} />
                <div className="results-scroll">
                  {usuariosEncontrados.map(u => (
                    <div key={u.id} className="user-result" onClick={() => setUsuarioSeleccionado(u)}>
                      {u.nombre} <span>ID: {u.codigo_contrato}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="invoice-generator-pro">
                <h3>GENERANDO FACTURA PARA: {usuarioSeleccionado.nombre}</h3>
                <div className="grid-consumo">
                  {Object.keys(consumo).map(item => (
                    <div className="field" key={item}>
                      <label>{item.toUpperCase()}</label>
                      <input type="number" onChange={(e) => setConsumo({...consumo, [item]: Number(e.target.value)})} />
                    </div>
                  ))}
                </div>
                <div className="summary-box">
                  <div className="row"><span>CARGO BASE:</span> <span>$100.00</span></div>
                  <div className="row"><span>CONSUMO:</span> <span>${(subtotal - 100).toFixed(2)}</span></div>
                  {notaDebito > 0 && <div className="row warn"><span>NOTA DÉBITO (15%):</span> <span>${notaDebito.toFixed(2)}</span></div>}
                  <div className="row total"><span>TOTAL A PAGAR:</span> <span>${total.toFixed(2)}</span></div>
                </div>
                <div className="footer-actions">
                  <button className="btn-confirm" onClick={handleEmitirFactura}>EMITIR FACTURA</button>
                  <button className="btn-cancel" onClick={() => setUsuarioSeleccionado(null)}>CANCELAR</button>
                </div>
              </div>
            )}
          </div>
        )}

        {pestanaActiva === 'pagos' && (
          <div className="admin-card-panel">
            <h3>PAGOS PENDIENTES DE CONFIRMACIÓN</h3>
            {pagosPendientes.length === 0 ? (
              <div className="empty-state">No hay pagos pendientes por confirmar.</div>
            ) : (
              <div className="results-scroll" style={{ marginTop: '20px' }}>
                {pagosPendientes.map(p => (
                  <div key={p.id} className="payment-item">
                    <div className="payment-info">
                      <strong>{p.nombre}</strong>
                      <div className="payment-meta">Factura #{p.factura_id} — Monto: ${Number(p.monto).toFixed(2)}</div>
                    </div>
                    <button className="btn-confirm-payment-item" onClick={() => handleConfirmarPago(p.factura_id)}>
                      Confirmar Pago
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}