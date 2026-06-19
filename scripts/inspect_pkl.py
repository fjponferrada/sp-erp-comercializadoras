import pandas as pd
import json

pkl_path = "Z:\\AED\\Prediccion\\base_datos_detalle.pkl"
df = pd.read_pickle(pkl_path)
print("Total rows:", len(df))
print("Columns:", list(df.columns))
print("First row:", json.dumps(df.iloc[0].to_dict(), default=str))
