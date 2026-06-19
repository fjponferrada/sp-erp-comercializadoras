import pandas as pd
import json
import sys

pkl_path = "Z:\\AED\\Prediccion\\base_datos_detalle.pkl"
chunk_size = 10000

print("Loading PKL...", file=sys.stderr)
df = pd.read_pickle(pkl_path)
print(f"Loaded {len(df)} rows. Starting stream...", file=sys.stderr)

for i in range(0, len(df), chunk_size):
    chunk = df.iloc[i:i+chunk_size]
    records = chunk.to_dict(orient='records')
    for record in records:
        # Convert timestamps to string format for JSON serialization
        for k, v in record.items():
            if pd.api.types.is_datetime64_any_dtype(type(v)):
                record[k] = str(v)
            elif pd.isna(v):
                record[k] = None
                
        print(json.dumps(record, default=str))
        
print("Stream finished.", file=sys.stderr)
