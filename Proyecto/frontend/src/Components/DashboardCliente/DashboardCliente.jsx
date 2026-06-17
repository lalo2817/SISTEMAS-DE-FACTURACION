import { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import './DashboardCliente.css';
import logoBurns from '../../assets/logo-burns.jpeg';

export default function DashboardCliente({ usuario, irALogin }) {
  const [pestaña, setPestaña] = useState('perfil');
  const [notificaciones, setNotificaciones] = useState([]);
  const [datosPerfil, setDatosPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [factura, setFactura] = useState(null);
  const [enviandoPago, setEnviandoPago] = useState(false);
  const [consumo, setConsumo] = useState({ tv: 0, microondas: 0, aireAcondicionado: 0, luces: 0, computadora: 0 });
  const [generandoFactura, setGenerandoFactura] = useState(false);

  useEffect(() => {
    if (!usuario?.id) return;
    const fetchPerfil = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`http://localhost:3000/usuarios/${usuario.id}`);
        setDatosPerfil(res.data);
      } catch (err) {
        console.error("Error al cargar datos:", err);
      } finally { setLoading(false); }
    };
    fetchPerfil();
  }, [usuario?.id]);

  useEffect(() => {
    if (!usuario?.id) return;

    const fetchEstado = async () => {
      try {
        const resNotif = await axios.get(`http://localhost:3000/notificaciones/${usuario.id}`);
        setNotificaciones(resNotif.data);
      } catch (err) { /* sin notificaciones aún */ }

      try {
        const resFactura = await axios.get(`http://localhost:3000/facturas/ultima/${usuario.id}`);
        setFactura(resFactura.data);
      } catch (err) {
        setFactura(null);
      }
    };

    fetchEstado();
    const interval = setInterval(fetchEstado, 5000);
    return () => clearInterval(interval);
  }, [usuario?.id]);

  const noLeidas = notificaciones.filter(n => !n.leido).length;

  const marcarLeidas = async () => {
    if (noLeidas === 0) return;
    try {
      await axios.post(`http://localhost:3000/notificaciones/marcar-leidas/${usuario.id}`);
      setNotificaciones(notificaciones.map(n => ({ ...n, leido: true })));
    } catch (err) { console.error(err); }
  };

  const PRECIOS = { tv: 2.5, microondas: 5.0, aireAcondicionado: 15.0, luces: 1.2, computadora: 4.0 };
  const CARGO_BASE = 100;

  const subtotalEstimado = CARGO_BASE
    + (consumo.tv || 0) * PRECIOS.tv
    + (consumo.microondas || 0) * PRECIOS.microondas
    + (consumo.aireAcondicionado || 0) * PRECIOS.aireAcondicionado
    + (consumo.luces || 0) * PRECIOS.luces
    + (consumo.computadora || 0) * PRECIOS.computadora;
  const notaDebitoEstimada = subtotalEstimado > 300 ? subtotalEstimado * 0.15 : 0;
  const totalEstimado = subtotalEstimado + notaDebitoEstimada;

  const manejarGenerarFactura = async () => {
    setGenerandoFactura(true);
    try {
      const res = await axios.post('http://localhost:3000/facturas/generar-cliente', {
        usuario_id: usuario.id,
        consumo
      });
      setFactura(res.data);
      alert("Factura generada. Espera a que Smithers confirme tu pago.");
    } catch (err) {
      const msg = err.response?.data?.message;
      if (msg) {
        alert(msg);
      } else {
        alert("Error al generar la factura.");
      }
      console.error(err);
    } finally {
      setGenerandoFactura(false);
    }
  };

  const manejarEnvioPago = async () => {
    if (!factura || factura.estado !== 'pendiente') return;

    setEnviandoPago(true);
    try {
      await axios.post('http://localhost:3000/pagar', {
        usuario_id: usuario.id,
        factura_id: factura.id,
        monto: factura.total
      });
      setFactura({ ...factura, estado: 'pagada' });
      alert("Pago enviado a Smithers para su confirmación.");
    } catch (err) {
      console.error(err);
      alert("Error al procesar el pago.");
    } finally {
      setEnviandoPago(false);
    }
  };

  const descargarFactura = (facturaParaDescargar) => {
    const f = facturaParaDescargar || factura;
    if (!f) {
      alert("No hay ninguna factura disponible para descargar.");
      return;
    }

    const doc = new jsPDF();

    doc.addImage(logoBurns, 'JPEG', 15, 12, 25, 25);

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('BURNS ENERGY', 50, 22);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Comprobante de Factura Eléctrica', 50, 29);

    doc.setDrawColor(200);
    doc.line(15, 42, 195, 42);

    doc.setFontSize(11);
    doc.text(`Cliente: ${datosPerfil?.nombre || usuario.nombre || ''}`, 15, 52);
    doc.text(`Contrato: ${datosPerfil?.codigo_contrato || '—'}`, 15, 59);
    doc.text(`Calle: ${datosPerfil?.calle || '—'}`, 15, 66);
    doc.text(`Fecha: ${new Date(f.created_at).toLocaleDateString()}`, 15, 73);

    doc.line(15, 80, 195, 80);

    // --- DESGLOSE DE CONSUMO ---
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Desglose de Consumo', 15, 90);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);

    let y = 98;
    doc.text('Cargo base mensual', 15, y);
    doc.text('$100.00', 180, y, { align: 'right' });

    const items = [
      { key: 'consumo_tv', label: 'Televisión', precio: 2.5 },
      { key: 'consumo_microondas', label: 'Microondas', precio: 5.0 },
      { key: 'consumo_aire', label: 'Aire Acondicionado', precio: 15.0 },
      { key: 'consumo_luces', label: 'Luces', precio: 1.2 },
      { key: 'consumo_computadora', label: 'Computadora', precio: 4.0 }
    ];

    items.forEach(item => {
      const horas = Number(f[item.key]) || 0;
      if (horas > 0) {
        y += 8;
        doc.text(`${item.label} (${horas} hrs x $${item.precio.toFixed(2)})`, 15, y);
        doc.text(`$${(horas * item.precio).toFixed(2)}`, 180, y, { align: 'right' });
      }
    });

    y += 10;
    doc.line(15, y, 195, y);

    // --- TOTALES ---
    y += 10;
    doc.setFontSize(12);
    doc.text('Subtotal:', 15, y);
    doc.text(`$${Number(f.subtotal).toFixed(2)}`, 180, y, { align: 'right' });

    if (Number(f.nota_debito) > 0) {
      y += 10;
      doc.setTextColor(200, 0, 0);
      doc.text('Nota de Débito (15%):', 15, y);
      doc.text(`+$${Number(f.nota_debito).toFixed(2)}`, 180, y, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    }

    y += 14;
    doc.setDrawColor(0);
    doc.line(15, y - 6, 195, y - 6);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAL:', 15, y);
    doc.text(`$${Number(f.total).toFixed(2)}`, 180, y, { align: 'right' });

    y += 14;
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    const estadoTexto = f.estado === 'confirmada'
      ? 'PAGADO Y CONFIRMADO'
      : f.estado === 'pagada'
        ? 'PAGO EN REVISIÓN POR SMITHERS'
        : 'PENDIENTE DE PAGO';
    doc.text(`Estado: ${estadoTexto}`, 15, y);

    // --- MENSAJE FINAL ---
    y += 20;
    doc.setFontSize(10);
    doc.setFont(undefined, 'italic');
    doc.text('Gracias por formar parte de Burns Energy.', 15, y);
    y += 6;
    doc.text('Recuerde generar su factura una vez al mes.', 15, y);
    y += 6;
    doc.setTextColor(180, 0, 0);
    doc.text('El incumplimiento de pago resultará en el corte del suministro eléctrico.', 15, y);
    doc.setTextColor(0, 0, 0);

    // --- FIRMA DE BURNS ---
    y += 25;
    doc.setFont('times', 'italic');
    doc.setFontSize(22);
    doc.text('M. Burns', 140, y);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.line(135, y + 3, 190, y + 3);
    doc.text('Montgomery Burns - Director General', 135, y + 9);

    doc.save(`Factura_${datosPerfil?.codigo_contrato || usuario.id}_${f.id}.pdf`);
  };

  if (loading) return <div className="loading-screen">INICIALIZANDO...</div>;

  return (
    <div className="dashboard-container">
      <header className="dash-header">
        <h1>BURNS ENERGY</h1>
        <div className="contract-tag">{datosPerfil?.codigo_contrato || 'SIN CONTRATO'}</div>
      </header>

      <main className="dash-content">
        {pestaña === 'perfil' && (
          <div className="section-card">
            {datosPerfil?.avatar_path && (
              <div className="avatar-container">
                <img
                  src={datosPerfil.avatar_path}
                  alt="Perfil"
                  className="profile-avatar"
                  style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #2ecc71', marginBottom: '15px' }}
                />
              </div>
            )}
            <h2 className="operator-name">{datosPerfil?.nombre?.toUpperCase()}</h2>
            <div className="profile-details">
              <p><span>SECTOR:</span> {datosPerfil?.calle || 'No definido'}</p>
              <p><span>CORREO:</span> {datosPerfil?.email}</p>
            </div>
            <button className="btn-shutdown" onClick={irALogin}>CERRAR SESIÓN</button>
          </div>
        )}

        {pestaña === 'facturas' && (
          <div className="section-card">
            <h2>MI FACTURA</h2>

            {(!factura || factura.estado === 'confirmada') && (
              <>
                {factura?.estado === 'confirmada' && (
                  <p className="status-confirmado" style={{ marginBottom: '15px' }}>✅ ¡PAGO CONFIRMADO POR SMITHERS!</p>
                )}
                <p style={{ textAlign: 'center', color: '#888', marginBottom: '5px' }}>
                  Ingresa tu consumo del mes para generar tu factura.
                </p>
                <p style={{ textAlign: 'center', color: '#00ffcc', fontSize: '0.85rem', marginBottom: '15px' }}>
                  Cargo base mensual: ${CARGO_BASE.toFixed(2)}
                </p>
                <div className="consumo-grid">
                  {Object.keys(consumo).map(item => (
                    <div key={item} className="item-input">
                      <label>{item.toUpperCase()} <span className="precio-unitario">(${PRECIOS[item].toFixed(2)}/hr)</span></label>
                      <input
                        type="number"
                        min="0"
                        value={consumo[item]}
                        onChange={(e) => setConsumo({ ...consumo, [item]: Number(e.target.value) })}
                      />
                    </div>
                  ))}
                </div>

                <div className="invoice-receipt">
                  <div className="line"><span>Cargo base:</span> <span>${CARGO_BASE.toFixed(2)}</span></div>
                  <div className="line"><span>Subtotal estimado:</span> <span>${subtotalEstimado.toFixed(2)}</span></div>
                  {notaDebitoEstimada > 0 && (
                    <div className="line debit-alert"><span>NOTA DE DÉBITO (15%):</span> <span>+${notaDebitoEstimada.toFixed(2)}</span></div>
                  )}
                  <div className="line grand-total"><span>TOTAL ESTIMADO:</span> <span>${totalEstimado.toFixed(2)}</span></div>
                </div>

                <button className="btn-confirm-payment" onClick={manejarGenerarFactura} disabled={generandoFactura}>
                  {generandoFactura ? 'GENERANDO...' : 'GENERAR FACTURA'}
                </button>
                {factura?.estado === 'confirmada' && (
                  <button className="btn-download" onClick={() => descargarFactura()}>
                    📄 DESCARGAR FACTURA ANTERIOR
                  </button>
                )}
              </>
            )}

            {factura && factura.estado !== 'confirmada' && (
              <>
                <div className="invoice-receipt">
                  <div className="line"><span>Cargo base:</span> <span>$100.00</span></div>
                  {Number(factura.consumo_tv) > 0 && <div className="line"><span>TV ({factura.consumo_tv} hrs):</span> <span>${(factura.consumo_tv * PRECIOS.tv).toFixed(2)}</span></div>}
                  {Number(factura.consumo_microondas) > 0 && <div className="line"><span>Microondas ({factura.consumo_microondas} hrs):</span> <span>${(factura.consumo_microondas * PRECIOS.microondas).toFixed(2)}</span></div>}
                  {Number(factura.consumo_aire) > 0 && <div className="line"><span>Aire Acondicionado ({factura.consumo_aire} hrs):</span> <span>${(factura.consumo_aire * PRECIOS.aireAcondicionado).toFixed(2)}</span></div>}
                  {Number(factura.consumo_luces) > 0 && <div className="line"><span>Luces ({factura.consumo_luces} hrs):</span> <span>${(factura.consumo_luces * PRECIOS.luces).toFixed(2)}</span></div>}
                  {Number(factura.consumo_computadora) > 0 && <div className="line"><span>Computadora ({factura.consumo_computadora} hrs):</span> <span>${(factura.consumo_computadora * PRECIOS.computadora).toFixed(2)}</span></div>}
                  <div className="line"><span>Subtotal:</span> <span>${Number(factura.subtotal).toFixed(2)}</span></div>
                  {Number(factura.nota_debito) > 0 && (
                    <div className="line debit-alert"><span>NOTA DE DÉBITO (15%):</span> <span>+${Number(factura.nota_debito).toFixed(2)}</span></div>
                  )}
                  <div className="line grand-total"><span>TOTAL:</span> <span>${Number(factura.total).toFixed(2)}</span></div>
                </div>

                {factura.estado === 'pendiente' && (
                  <button className="btn-confirm-payment" onClick={manejarEnvioPago} disabled={enviandoPago}>
                    {enviandoPago ? 'ENVIANDO...' : 'ENVIAR PAGO A SMITHERS'}
                  </button>
                )}

                {factura.estado === 'pagada' && (
                  <p className="status-waiting">⌛ PAGO ENVIADO. ESPERANDO CONFIRMACIÓN DE SMITHERS...</p>
                )}

                <button className="btn-download" onClick={() => descargarFactura()}>
                  📄 DESCARGAR FACTURA
                </button>
              </>
            )}
          </div>
        )}

        {pestaña === 'notificaciones' && (
          <div className="section-card">
            <h2>COMUNICACIONES</h2>
            <div className="notif-container">
              {notificaciones.length > 0 ? (
                notificaciones.map((n, i) => (
                  <div key={i} className={`notif-card ${!n.leido ? 'no-leido' : ''}`}>
                    <p>{n.mensaje}</p>
                    {(n.mensaje?.toLowerCase().includes('confirmado') || n.mensaje?.toLowerCase().includes('generó tu factura')) && factura && (
                      <button className="btn-download-notif" onClick={() => descargarFactura(factura)}>
                        📄 Descargar factura
                      </button>
                    )}
                  </div>
                ))
              ) : <p>Sin notificaciones nuevas.</p>}
            </div>
          </div>
        )}
      </main>

      <nav className="dash-nav-bar">
        <button onClick={() => setPestaña('perfil')}>PERFIL</button>
        <button onClick={() => setPestaña('facturas')}>FACTURA</button>
        <button onClick={() => { setPestaña('notificaciones'); marcarLeidas(); }} className="nav-btn-notif">
          AVISOS
          {noLeidas > 0 && <span className="badge-notif">{noLeidas}</span>}
        </button>
      </nav>
    </div>
  );
}
