'use client';

import { useState } from 'react';
import { format } from 'date-fns';

export default function SimelViewerClient() {
  const [dataType, setDataType] = useState('horarios');
  const [fileType, setFileType] = useState('EPFPF');
  const [closureType, setClosureType] = useState('H3');
  const [showTotal, setShowTotal] = useState('SI');
  
  const [fromDate, setFromDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [monthDate, setMonthDate] = useState(() => format(new Date(), 'yyyy-MM'));

  // Handler para cambiar tipo de datos
  const handleDataTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value;
    setDataType(newVal);
    // Reset file types based on the selected mode
    if (newVal === 'horarios') {
      setFileType('EPFPF');
    } else {
      setFileType('ACUM');
    }
  };

  const handleConsultar = () => {
    alert('Esta funcionalidad estará disponible próximamente.');
  };

  return (
    <div style={{ background: 'var(--bg-card)', padding: '32px', borderRadius: '12px', border: '1px solid var(--border)' }}>
      <p style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '0.875rem' }}>
        Seleccione una de las siguientes opciones:
      </p>

      {/* Main Mode Selector */}
      <div style={{ marginBottom: '32px' }}>
        <select 
          className="form-select" 
          value={dataType} 
          onChange={handleDataTypeChange}
          style={{ width: '100%', borderColor: 'var(--border)', color: 'var(--brand-primary)', background: 'var(--bg-elevated)', padding: '12px', borderRadius: '4px', fontSize: '1rem', fontWeight: 500 }}
        >
          <option value="horarios">Datos Horarios</option>
          <option value="mensuales">Datos Mensuales</option>
        </select>
      </div>

      {/* Filters Row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginBottom: '32px' }}>
        {/* Tipo de Archivo */}
        <div style={{ flex: '1 1 300px', display: 'flex', alignItems: 'center' }}>
          <div style={{ background: 'var(--brand-primary)', color: 'white', padding: '10px 16px', borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px', fontSize: '0.875rem', fontWeight: 500, minWidth: '130px', textAlign: 'center' }}>
            Tipo de archivo
          </div>
          <select 
            className="form-select" 
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            style={{ flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, height: '40px', background: 'var(--bg-elevated)' }}
          >
            {dataType === 'horarios' ? (
              <>
                <option value="EPFPF">EPFPF</option>
                <option value="MAGCLOS">MAGCLOS</option>
                <option value="UPR">UPR</option>
                <option value="VERT">VERT</option>
              </>
            ) : (
              <>
                <option value="ACUM">ACUM</option>
                <option value="INMECLOS">INMECLOS</option>
                <option value="MAGCLACUM">MAGCLACUM</option>
              </>
            )}
          </select>
        </div>

        {/* Tipo de Cierre */}
        <div style={{ flex: '1 1 300px', display: 'flex', alignItems: 'center' }}>
          <div style={{ background: 'var(--brand-primary)', color: 'white', padding: '10px 16px', borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px', fontSize: '0.875rem', fontWeight: 500, minWidth: '130px', textAlign: 'center' }}>
            Tipo de cierre
          </div>
          <select 
            className="form-select" 
            value={closureType}
            onChange={(e) => setClosureType(e.target.value)}
            style={{ flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, height: '40px', background: 'var(--bg-elevated)' }}
          >
            <option value="" disabled>Seleccione un cierre</option>
            <option value="HD">HD</option>
            <option value="H3">H3</option>
            <option value="HP">HP</option>
            <option value="HC">HC</option>
            <option value="TODOS">TODOS</option>
          </select>
        </div>

        {/* Total (Only if Horarios) */}
        {dataType === 'horarios' && (
          <div style={{ flex: '1 1 150px', display: 'flex', alignItems: 'center' }}>
            <div style={{ background: 'var(--brand-primary)', color: 'white', padding: '10px 16px', borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px', fontSize: '0.875rem', fontWeight: 500, minWidth: '80px', textAlign: 'center' }}>
              Total
            </div>
            <select 
              className="form-select" 
              value={showTotal}
              onChange={(e) => setShowTotal(e.target.value)}
              style={{ flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, height: '40px', background: 'var(--bg-elevated)' }}
            >
              <option value="SI">SI</option>
              <option value="NO">NO</option>
            </select>
          </div>
        )}
      </div>

      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.875rem', textTransform: 'uppercase', fontWeight: 600 }}>
        Consultar Leyenda »
      </p>

      {/* Date Pickers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px', maxWidth: '300px' }}>
        {dataType === 'horarios' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ background: 'var(--brand-primary)', color: 'white', padding: '10px 16px', borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px', fontSize: '0.875rem', fontWeight: 500, minWidth: '80px', textAlign: 'center' }}>
                Desde
              </div>
              <input 
                type="date" 
                className="form-input" 
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{ flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, height: '40px', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ background: 'var(--brand-primary)', color: 'white', padding: '10px 16px', borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px', fontSize: '0.875rem', fontWeight: 500, minWidth: '80px', textAlign: 'center' }}>
                Hasta
              </div>
              <input 
                type="date" 
                className="form-input" 
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{ flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, height: '40px', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              />
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ background: 'var(--brand-primary)', color: 'white', padding: '10px 16px', borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px', fontSize: '0.875rem', fontWeight: 500, minWidth: '80px', textAlign: 'center' }}>
                Desde
              </div>
              <input 
                type="month" 
                className="form-input" 
                value={monthDate}
                onChange={(e) => setMonthDate(e.target.value)}
                style={{ flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, height: '40px', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ background: 'var(--brand-primary)', color: 'white', padding: '10px 16px', borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px', fontSize: '0.875rem', fontWeight: 500, minWidth: '80px', textAlign: 'center' }}>
                Hasta
              </div>
              <input 
                type="month" 
                className="form-input" 
                value={monthDate}
                onChange={(e) => setMonthDate(e.target.value)}
                style={{ flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, height: '40px', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              />
            </div>
          </>
        )}
      </div>

      <button className="btn-primary" onClick={handleConsultar} style={{ marginBottom: '40px' }}>
        Consultar Datos
      </button>

      {/* Legends */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'var(--brand-primary)', color: 'white', padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600 }}>
            Leyenda tipo de archivo:
          </div>
          <div style={{ padding: '24px', fontSize: '0.875rem', color: 'var(--text-primary)', flex: 1 }}>
            <p style={{ marginBottom: '16px' }}><strong>EPFPF:</strong> Datos horarios de energía de puntos frontera</p>
            <p style={{ marginBottom: '16px' }}><strong>MAGCLOS:</strong> Datos horarios de energía de agregaciones de clientes tipo 3, 4 y 5</p>
            <p style={{ marginBottom: '16px' }}><strong>UPR:</strong> Datos horarios de energía de unidades de programación</p>
            <p style={{ marginBottom: '16px' }}><strong>VERT:</strong> Datos horarios de energía vertida de autoconsumo por unidad de programación de adquisición</p>
            <p style={{ marginBottom: '16px' }}><strong>ACUM:</strong> Acumulado mensual de energía de puntos frontera</p>
            <p style={{ marginBottom: '16px' }}><strong>INMECLOS:</strong> Acumulado mensual de energía de clientes tipo 3, 4 y 5 desagregados</p>
            <p><strong>MAGCLACUM:</strong> Acumulado mensual de energía de agregaciones de clientes tipo 3, 4 y 5</p>
          </div>
        </div>
        
        <div style={{ background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'var(--brand-primary)', color: 'white', padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600 }}>
            Leyenda tipo de cierre:
          </div>
          <div style={{ padding: '24px', fontSize: '0.875rem', color: 'var(--text-primary)', flex: 1 }}>
            <p style={{ marginBottom: '16px' }}><strong>H3:</strong> Valores de cierre de mes m-3</p>
            <p style={{ marginBottom: '16px' }}><strong>HP:</strong> Valores de cierre provisional</p>
            <p style={{ marginBottom: '16px' }}><strong>HC:</strong> Valores de cierre definitivo</p>
            <p style={{ marginBottom: '16px' }}><strong>HD:</strong> Valores de cierre diario</p>
            <p><strong>Todos:</strong> Saldrán todos los archivos indicados anteriormente</p>
          </div>
        </div>
      </div>

    </div>
  );
}
