import pandas as pd
import sys

erp_file = r"Z:\AED\Prediccion\curva_ES0031105637126001AF0F_20250401-20251231.csv"
py_file = r"Z:\AED\Prediccion\cch_python_ES0031105637126001AF.csv"
ingebau_file = r"Z:\AED\Prediccion\cch_ingebau_ES0031105637126001AF0F.csv"

def load_file(path, name):
    try:
        # Most of these files seem to use ';' as separator and ',' as decimal based on previous code
        df = pd.read_csv(path, sep=';', decimal=',')
        print(f"[{name}] Loaded {len(df)} rows.")
        return df
    except Exception as e:
        # Ingebau might be comma separated? Try fallback
        try:
            df = pd.read_csv(path)
            print(f"[{name}] Loaded {len(df)} rows (fallback format).")
            return df
        except Exception as e2:
            print(f"[{name}] Error loading: {e2}")
            return None

print("Loading files...")
df_erp = load_file(erp_file, "ERP")
df_py = load_file(py_file, "Python")
df_ing = load_file(ingebau_file, "Ingebau")

if df_erp is not None:
    print(f"[ERP] Columns: {df_erp.columns.tolist()}")
    if 'consumo_kwh' in df_erp.columns:
        print(f"[ERP] Total kWh: {df_erp['consumo_kwh'].sum():.2f}")
        print(f"[ERP] Head:\n{df_erp.head(2).to_string()}")

if df_py is not None:
    print(f"[Python] Columns: {df_py.columns.tolist()}")
    if 'consumo_kwh' in df_py.columns:
        print(f"[Python] Total kWh: {df_py['consumo_kwh'].sum():.2f}")
        print(f"[Python] Head:\n{df_py.head(2).to_string()}")

if df_ing is not None:
    print(f"[Ingebau] Columns: {df_ing.columns.tolist()}")
    # Attempt to find kWh column
    kwh_col = [c for c in df_ing.columns if 'kwh' in str(c).lower() or 'consumo' in str(c).lower() or 'active' in str(c).lower()]
    if kwh_col:
        col = kwh_col[0]
        # if string with commas, replace them
        if df_ing[col].dtype == object:
            df_ing[col] = df_ing[col].str.replace(',', '.').astype(float)
        print(f"[Ingebau] Total kWh ({col}): {df_ing[col].sum():.2f}")
        print(f"[Ingebau] Head:\n{df_ing.head(2).to_string()}")

