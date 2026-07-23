import os
import pandas as pd

file_path = "digit direction arrangement.xlsx"
if os.path.exists(file_path):
    try:
        xl = pd.ExcelFile(file_path)
        print("Sheets:", xl.sheet_names)
        for sheet in xl.sheet_names:
            print(f"\n--- {sheet} sheet ---")
            df = xl.parse(sheet)
            print("Shape:", df.shape)
            print(df.head(20))
    except Exception as e:
        print("Error reading excel:", e)
else:
    print("File does not exist")
