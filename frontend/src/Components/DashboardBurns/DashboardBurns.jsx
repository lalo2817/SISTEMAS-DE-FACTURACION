import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './DashboardBurns.css';

export default function DashboardBurns({ cerrarSesion }) {
  const [seccion, setSeccion] = useState('resumen');
  const [busqueda, setBusqueda] = useState('');

  const [resumen, setResumen] = useState({
    usuariosRegistrados: 0,
    facturasRealizadas: 0,
    ingresosMes: [],
    estadosPago: { confirmada: 0, pagada: 0, pendiente: 0 }
  });

  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);

  // --- SINCRONIZACIÓN CON BACKEND ---
  const cargarDatos = async () => {
    try {
      const [resDashboard, resClientes] = await Promise.all([
        axios.get('http://localhost:3000/admin/dashboard'),
        axios.get('http://localhost:3000/admin/clientes')
      ]);
      setResumen(resDashboard.data);
      setClientes(resClientes.data);
    } catch (err) {
      console.error('Error al sincronizar panel de Burns:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    // Sincroniza cada 10 segundos con lo que hagan los clientes/Smithers
    const interval = setInterval(cargarDatos, 10000);
    return () => clearInterval(interval);
  }, []);

  // --- DATOS PARA EL CÍRCULO DE ESTADOS ---
  const { confirmada, pagada, pendiente } = resumen.estadosPago;
  const totalFacturas = confirmada + pagada + pendiente;

  const datosPagos = totalFacturas === 0
    ? [{ name: 'Sin facturas', value: 1, color: '#3a3a55' }]
    : [
        { name: 'Pagados (confirmado)', value: confirmada, color: '#00f5d4' },
        { name: 'Pendiente a confirmar', value: pagada, color: '#ff9f1c' },
        { name: 'No pagado', value: pendiente, color: '#ff3333' }
      ].filter(d => d.value > 0);

  // --- ETIQUETAS DE ESTADO PARA LA TABLA ---
  const estadoLabel = {
    pagado: { texto: 'PAGADO', clase: 'pagado' },
    pend_confirmar: { texto: 'PENDIENTE A CONFIRMAR', clase: 'pend_confirmar' },
    no_pagado: { texto: 'NO PAGADO', clase: 'impago' },
    sin_factura: { texto: 'SIN FACTURA', clase: 'sin_factura' }
  };

  return (
    <div className="burns-erp-layout">
      <aside className="burns-sidebar">
        <h2>⚡ BURN-ERP</h2>
        <div className="admin-info">
          <p>MODO ADMINISTRADOR</p>
          <small>USUARIO: M. BURNS</small>
        </div>
        <nav>
          <button onClick={() => setSeccion('resumen')} className={seccion === 'resumen' ? 'active' : ''}>📊 Resumen Completo</button>
          <button onClick={() => setSeccion('clientes')} className={seccion === 'clientes' ? 'active' : ''}>👥 Clientes Registrados</button>
        </nav>
        <button className="btn-logout" onClick={cerrarSesion}>CERRAR CONSOLA</button>
      </aside>

      <main className="burns-main-content">
        {seccion === 'resumen' && (
          <div className="seccion-fade">
            <header><h3>Centro de Mando Supremo</h3></header>

            <div className="kpi-row">
              <div className="card">
                <h4>USUARIOS REGISTRADOS</h4>
                <h2>{cargando ? '...' : resumen.usuariosRegistrados}</h2>
              </div>
              <div className="card">
                <h4>FACTURAS REALIZADAS</h4>
                <h2>{cargando ? '...' : resumen.facturasRealizadas}</h2>
              </div>
            </div>

            <div className="chart-row">
              <div className="card chart-box">
                <h4>Ingresos confirmados del mes</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={resumen.ingresosMes}>
                    <CartesianGrid stroke="#2d2645" />
                    <XAxis dataKey="dia" />
                    <YAxis />
                    <Tooltip contentStyle={{ background: '#130f24' }} />
                    <Line type="monotone" dataKey="monto" stroke="#00f5d4" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
                {resumen.ingresosMes.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#5c5c77' }}>Sin ingresos confirmados este mes todavía.</p>
                )}
              </div>

              <div className="card chart-box">
                <h4>Estado de Pagos</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={datosPagos} innerRadius={60} outerRadius={80} dataKey="value">
                      {datosPagos.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="leyenda-pagos">
                  <span><i style={{ background: '#00f5d4' }}></i> Pagados</span>
                  <span><i style={{ background: '#ff9f1c' }}></i> Pendiente a confirmar</span>
                  <span><i style={{ background: '#ff3333' }}></i> No pagado</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {seccion === 'clientes' && (
          <div className="seccion-fade">
            <h3>Clientes Registrados</h3>
            <input
              className="search-bar"
              placeholder="Buscar cliente o calle..."
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <div className="burns-table-wrapper">
            <table className="burns-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Calle</th>
                  <th>Contrato</th>
                  <th>Última Factura</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {clientes
                  .filter(c =>
                    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                    (c.calle || '').toLowerCase().includes(busqueda.toLowerCase())
                  )
                  .map(c => (
                    <tr key={c.id}>
                      <td>{c.nombre}</td>
                      <td>{c.email}</td>
                      <td>{c.calle}</td>
                      <td>{c.codigo_contrato || '—'}</td>
                      <td>{c.total ? `$${c.total}` : '—'}</td>
                      <td>
                        <span className={`badge ${estadoLabel[c.estado].clase}`}>
                          {estadoLabel[c.estado].texto}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            </div>
            {clientes.length === 0 && !cargando && (
              <p style={{ color: '#5c5c77' }}>Aún no hay clientes registrados.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}