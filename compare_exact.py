import pandas as pd
import numpy as np

erp_file = r"Z:\AED\Prediccion\curva_ES0031105637126001AF0F_20250401-20251231 (1).csv"
ingebau_file = r"Z:\AED\Prediccion\cch_ingebau_ES0031105637126001AF0F.csv"

# Load ERP
df_erp = pd.read_csv(erp_file, sep=';', decimal=',')
df_erp['fecha_hora'] = pd.to_datetime(df_erp['fecha_hora'])

# Load Ingebau
df_ing = pd.read_csv(ingebau_file, sep=';', decimal=',')
# Normalize Ingebau columns
col_ing = [c for c in df_ing.columns if 'kwh' in str(c).lower() or 'active' in str(c).lower()][0]
if df_ing[col_ing].dtype == object:
    df_ing[col_ing] = df_ing[col_ing].str.replace(',', '.').astype(float)
df_ing['Fecha'] = pd.to_datetime(df_ing['Fecha'])

# Filter Ingebau from the first date in ERP
start_date = df_erp['fecha_hora'].min()
df_ing_filtered = df_ing[df_ing['Fecha'] >= start_date].copy()

# Sort both just in case
df_erp = df_erp.sort_values('fecha_hora').reset_index(drop=True)
df_ing_filtered = df_ing_filtered.sort_values('Fecha').reset_index(drop=True)

print(f"ERP Rows: {len(df_erp)}")
print(f"Ingebau Filtered Rows: {len(df_ing_filtered)}")

if len(df_erp) != len(df_ing_filtered):
    print("WARNING: Row counts do not match!")
    # Find missing
    erp_dates = set(df_erp['fecha_hora'])
    ing_dates = set(df_ing_filtered['Fecha'])
    print(f"In Ingebau but not ERP: {len(ing_dates - erp_dates)} dates")
    print(f"In ERP but not Ingebau: {len(erp_dates - ing_dates)} dates")

# Let's do a merge on the date
merged = pd.merge(df_erp, df_ing_filtered, left_on='fecha_hora', right_on='Fecha', how='inner')
print(f"\nMerged Rows: {len(merged)}")

merged['diff'] = np.abs(merged['consumo_kwh'] - merged[col_ing])

max_diff = merged['diff'].max()
print(f"\nMax absolute difference: {max_diff:.5f} kWh")

differences = merged[merged['diff'] > 0.001]
print(f"Number of hours with > 0.001 kWh difference: {len(differences)}")

if len(differences) > 0:
    print("\nTop 5 differences:")
    diff_show = differences[['fecha_hora', 'consumo_kwh', col_ing, 'diff', 'Procedencia Energia Activa']].sort_values('diff', ascending=False)
    print(diff_show.head(10).to_string())

# Sum check
print(f"\nTotal kWh ERP (common period): {merged['consumo_kwh'].sum():.3f}")
print(f"Total kWh Ingebau (common period): {merged[col_ing].sum():.3f}")
