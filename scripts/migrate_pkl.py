import pandas as pd
import numpy as np
import sys
import gc
import io

# Force UTF-8 stdout if needed, but safer to just not use emojis
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import shutil
import os

pkl_path_network = r"Z:\AED\Prediccion\base_datos_detalle.pkl"
pkl_path_local = r"C:\Users\Administrator\sp-erp-comercializadoras\base_datos_detalle_temp.pkl"
csv_path = r"Z:\AED\Prediccion\export_daily.csv"

print("Iniciando migracion de datos...")
print("Copiando PKL de red a disco local para evitar OSError 22...")
shutil.copy2(pkl_path_network, pkl_path_local)

print("Cargando PKL local (esto tardara 1-2 minutos)...")
df = pd.read_pickle(pkl_path_local)

print("Borrando PKL temporal...")
os.remove(pkl_path_local)

print(f"Cargado. Filas originales: {len(df):,}")

print("Procesando fechas...")
df['fecha_hora'] = pd.to_datetime(df['fecha_hora'], utc=True)

# Solo migrar datos nuevos para no procesar años enteros
min_date = pd.to_datetime('2026-02-01', utc=True)
df = df[df['fecha_hora'] >= min_date].copy()

df['fecha'] = df['fecha_hora'].dt.date
df['hora'] = df['fecha_hora'].dt.hour

# Limpiar memoria
df.drop(columns=['fecha_hora', 'segmento'], inplace=True, errors='ignore')
gc.collect()

print("Pivotando 28M filas a arrays diarios (1 fila por dia por CUPS)...")
df_pivoted = df.pivot_table(
    index=['cups', 'fecha'],
    columns='hora',
    values='consumo_kwh',
    aggfunc='sum',
    fill_value=0.0
)

# Aplanar multi-index
df_pivoted = df_pivoted.reset_index()

# Asegurar que todas las 24 horas existen
for i in range(24):
    if i not in df_pivoted.columns:
        df_pivoted[i] = 0.0

# Reordenar y renombrar
df_pivoted = df_pivoted[['cups', 'fecha'] + list(range(24))]
column_names = ['cups', 'fecha'] + [f"h{i}" for i in range(24)]
df_pivoted.columns = column_names

print(f"Pivotado. Filas resultantes comprimidas: {len(df_pivoted):,}")

print(f"Guardando en CSV ultra-ligero -> {csv_path}")
df_pivoted.to_csv(csv_path, index=False, float_format='%.4f')
print("CSV generado correctamente!")
