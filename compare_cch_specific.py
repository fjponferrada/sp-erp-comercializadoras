import pandas as pd

erp_file = r"Z:\AED\Prediccion\curva_ES0031105637126001AF0F_20250401-20251231.csv"
py_file = r"Z:\AED\Prediccion\cch_python_ES0031105637126001AF.csv"
ingebau_file = r"Z:\AED\Prediccion\cch_ingebau_ES0031105637126001AF0F.csv"

df_erp = pd.read_csv(erp_file, sep=';', decimal=',')
df_py = pd.read_csv(py_file, sep=';', decimal=',')
df_ing = pd.read_csv(ingebau_file)
col_ing = [c for c in df_ing.columns if 'kwh' in str(c).lower() or 'consumo' in str(c).lower() or 'active' in str(c).lower()][0]
if df_ing[col_ing].dtype == object:
    df_ing[col_ing] = df_ing[col_ing].str.replace(',', '.').astype(float)

# We want to see 2025-12-31 hour 00:00:00
print("--- ERP ---")
print(df_erp[df_erp['fecha_hora'].str.startswith('2025-12-31 00:00:00')])
print(df_erp[df_erp['fecha_hora'].str.startswith('2025-12-31 01:00:00')])

print("\n--- Python ---")
print(df_py[df_py['fecha_hora'].str.startswith('2025-12-31 00:00:00')])
print(df_py[df_py['fecha_hora'].str.startswith('2025-12-31 01:00:00')])

print("\n--- Ingebau ---")
print(df_ing[df_ing['Fecha'].str.startswith('2025-12-31 00:00:00')][['Fecha', col_ing]])
print(df_ing[df_ing['Fecha'].str.startswith('2025-12-31 01:00:00')][['Fecha', col_ing]])

