import fitz  # PyMuPDF
import sys

def read_pdf(file_path):
    try:
        doc = fitz.open(file_path)
        for page_num in range(min(2, len(doc))):
            text = doc.load_page(page_num).get_text()
            print(f"--- Page {page_num + 1} ---")
            for line in text.split('\n'):
                if 'expediente' in line.lower() or 'referencia' in line.lower():
                    print(line)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    read_pdf(r"Z:\AED\AEAT (hasta 16jul)\560\260702 COMUNICACION DESGLOSA MOD 560.pdf")
